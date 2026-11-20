function realAddons(){if(realAddons.ok!=null)return realAddons.ok;if(typeof THREE==="undefined")return false;try{
(function(){
var CopyShader={
uniforms:{
'tDiffuse':{
value:null
},
'opacity':{
value:1.0
}
},
vertexShader:
`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
fragmentShader:
`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;

		}`
};
THREE.CopyShader=CopyShader;
})();
(function(){
const SSAOShader={
defines:{
'PERSPECTIVE_CAMERA':1,
'KERNEL_SIZE':32
},
uniforms:{
'tDiffuse':{
value:null
},
'tNormal':{
value:null
},
'tDepth':{
value:null
},
'tNoise':{
value:null
},
'kernel':{
value:null
},
'cameraNear':{
value:null
},
'cameraFar':{
value:null
},
'resolution':{
value:new THREE.Vector2()
},
'cameraProjectionMatrix':{
value:new THREE.Matrix4()
},
'cameraInverseProjectionMatrix':{
value:new THREE.Matrix4()
},
'kernelRadius':{
value:8
},
'minDistance':{
value:0.005
},
'maxDistance':{
value:0.05
}
},
vertexShader:
`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
fragmentShader:
`

		uniform sampler2D tDiffuse;
		uniform sampler2D tNormal;
		uniform sampler2D tDepth;
		uniform sampler2D tNoise;

		uniform vec3 kernel[ KERNEL_SIZE ];

		uniform vec2 resolution;

		uniform float cameraNear;
		uniform float cameraFar;
		uniform mat4 cameraProjectionMatrix;
		uniform mat4 cameraInverseProjectionMatrix;

		uniform float kernelRadius;
		uniform float minDistance; // avoid artifacts caused by neighbour fragments with minimal depth difference
		uniform float maxDistance; // avoid the influence of fragments which are too far away

		varying vec2 vUv;

		#include <packing>

		float getDepth( const in vec2 screenPosition ) {

			return texture2D( tDepth, screenPosition ).x;

		}

		float getLinearDepth( const in vec2 screenPosition ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, screenPosition ).x;

			#endif

		}

		float getViewZ( const in float depth ) {

			#if PERSPECTIVE_CAMERA == 1

				return perspectiveDepthToViewZ( depth, cameraNear, cameraFar );

			#else

				return orthographicDepthToViewZ( depth, cameraNear, cameraFar );

			#endif

		}

		vec3 getViewPosition( const in vec2 screenPosition, const in float depth, const in float viewZ ) {

			float clipW = cameraProjectionMatrix[2][3] * viewZ + cameraProjectionMatrix[3][3];

			vec4 clipPosition = vec4( ( vec3( screenPosition, depth ) - 0.5 ) * 2.0, 1.0 );

			clipPosition *= clipW; // unprojection.

			return ( cameraInverseProjectionMatrix * clipPosition ).xyz;

		}

		vec3 getViewNormal( const in vec2 screenPosition ) {

			return unpackRGBToNormal( texture2D( tNormal, screenPosition ).xyz );

		}

		void main() {

			float depth = getDepth( vUv );
			float viewZ = getViewZ( depth );

			vec3 viewPosition = getViewPosition( vUv, depth, viewZ );
			vec3 viewNormal = getViewNormal( vUv );

			vec2 noiseScale = vec2( resolution.x / 4.0, resolution.y / 4.0 );
			vec3 random = texture2D( tNoise, vUv * noiseScale ).xyz;

			// compute matrix used to reorient a kernel vector

			vec3 tangent = normalize( random - viewNormal * dot( random, viewNormal ) );
			vec3 bitangent = cross( viewNormal, tangent );
			mat3 kernelMatrix = mat3( tangent, bitangent, viewNormal );

		 float occlusion = 0.0;

		 for ( int i = 0; i < KERNEL_SIZE; i ++ ) {

				vec3 sampleVector = kernelMatrix * kernel[ i ]; // reorient sample vector in view space
				vec3 samplePoint = viewPosition + ( sampleVector * kernelRadius ); // calculate sample point

				vec4 samplePointNDC = cameraProjectionMatrix * vec4( samplePoint, 1.0 ); // project point and calculate NDC
				samplePointNDC /= samplePointNDC.w;

				vec2 samplePointUv = samplePointNDC.xy * 0.5 + 0.5; // compute uv coordinates

				float realDepth = getLinearDepth( samplePointUv ); // get linear depth from depth texture
				float sampleDepth = viewZToOrthographicDepth( samplePoint.z, cameraNear, cameraFar ); // compute linear depth of the sample view Z value
				float delta = sampleDepth - realDepth;

				if ( delta > minDistance && delta < maxDistance ) { // if fragment is before sample point, increase occlusion

					occlusion += 1.0;

				}

			}

			occlusion = clamp( occlusion / float( KERNEL_SIZE ), 0.0, 1.0 );

			gl_FragColor = vec4( vec3( 1.0 - occlusion ), 1.0 );

		}`
};
const SSAODepthShader={
defines:{
'PERSPECTIVE_CAMERA':1
},
uniforms:{
'tDepth':{
value:null
},
'cameraNear':{
value:null
},
'cameraFar':{
value:null
}
},
vertexShader: `varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
fragmentShader: `uniform sampler2D tDepth;

		uniform float cameraNear;
		uniform float cameraFar;

		varying vec2 vUv;

		#include <packing>

		float getLinearDepth( const in vec2 screenPosition ) {

			#if PERSPECTIVE_CAMERA == 1

				float fragCoordZ = texture2D( tDepth, screenPosition ).x;
				float viewZ = perspectiveDepthToViewZ( fragCoordZ, cameraNear, cameraFar );
				return viewZToOrthographicDepth( viewZ, cameraNear, cameraFar );

			#else

				return texture2D( tDepth, screenPosition ).x;

			#endif

		}

		void main() {

			float depth = getLinearDepth( vUv );
			gl_FragColor = vec4( vec3( 1.0 - depth ), 1.0 );

		}`
};
const SSAOBlurShader={
uniforms:{
'tDiffuse':{
value:null
},
'resolution':{
value:new THREE.Vector2()
}
},
vertexShader: `varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
fragmentShader: `uniform sampler2D tDiffuse;

		uniform vec2 resolution;

		varying vec2 vUv;

		void main() {

			vec2 texelSize = ( 1.0 / resolution );
			float result = 0.0;

			for ( int i = - 2; i <= 2; i ++ ) {

				for ( int j = - 2; j <= 2; j ++ ) {

					vec2 offset = ( vec2( float( i ), float( j ) ) ) * texelSize;
					result += texture2D( tDiffuse, vUv + offset ).r;

				}

			}

			gl_FragColor = vec4( vec3( result / ( 5.0 * 5.0 ) ), 1.0 );

		}`
};
THREE.SSAOBlurShader=SSAOBlurShader;
THREE.SSAODepthShader=SSAODepthShader;
THREE.SSAOShader=SSAOShader;
})();
(function(){
const FXAAShader={
uniforms:{
'tDiffuse':{
value:null
},
'resolution':{
value:new THREE.Vector2(1/1024,1/512)
}
},
vertexShader:
`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
fragmentShader:
`

		precision highp float;

		uniform sampler2D tDiffuse;

		uniform vec2 resolution;

		varying vec2 vUv;

		#define FXAA_PC 1
		#define FXAA_GLSL_100 1
		#define FXAA_QUALITY_PRESET 12

		#define FXAA_GREEN_AS_LUMA 1

		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_PC_CONSOLE
				//
				// The console algorithm for PC is included
				// for developers targeting really low spec machines.
				// Likely better to just run FXAA_PC, and use a really low preset.
				//
				#define FXAA_PC_CONSOLE 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_GLSL_120
				#define FXAA_GLSL_120 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_GLSL_130
				#define FXAA_GLSL_130 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_HLSL_3
				#define FXAA_HLSL_3 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_HLSL_4
				#define FXAA_HLSL_4 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_HLSL_5
				#define FXAA_HLSL_5 0
		#endif
		/*==========================================================================*/
		#ifndef FXAA_GREEN_AS_LUMA
				//
				// For those using non-linear color,
				// and either not able to get luma in alpha, or not wanting to,
				// this enables FXAA to run using green as a proxy for luma.
				// So with this enabled, no need to pack luma in alpha.
				//
				// This will turn off AA on anything which lacks some amount of green.
				// Pure red and blue or combination of only R and B, will get no AA.
				//
				// Might want to lower the settings for both,
				//		fxaaConsoleEdgeThresholdMin
				//		fxaaQualityEdgeThresholdMin
				// In order to insure AA does not get turned off on colors
				// which contain a minor amount of green.
				//
				// 1 = On.
				// 0 = Off.
				//
				#define FXAA_GREEN_AS_LUMA 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_EARLY_EXIT
				//
				// Controls algorithm\'s early exit path.
				// On PS3 turning this ON adds 2 cycles to the shader.
				// On 360 turning this OFF adds 10ths of a millisecond to the shader.
				// Turning this off on console will result in a more blurry image.
				// So this defaults to on.
				//
				// 1 = On.
				// 0 = Off.
				//
				#define FXAA_EARLY_EXIT 1
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_DISCARD
				//
				// Only valid for PC OpenGL currently.
				// Probably will not work when FXAA_GREEN_AS_LUMA = 1.
				//
				// 1 = Use discard on pixels which don\'t need AA.
				//		 For APIs which enable concurrent TEX+ROP from same surface.
				// 0 = Return unchanged color on pixels which don\'t need AA.
				//
				#define FXAA_DISCARD 0
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_FAST_PIXEL_OFFSET
				//
				// Used for GLSL 120 only.
				//
				// 1 = GL API supports fast pixel offsets
				// 0 = do not use fast pixel offsets
				//
				#ifdef GL_EXT_gpu_shader4
						#define FXAA_FAST_PIXEL_OFFSET 1
				#endif
				#ifdef GL_NV_gpu_shader5
						#define FXAA_FAST_PIXEL_OFFSET 1
				#endif
				#ifdef GL_ARB_gpu_shader5
						#define FXAA_FAST_PIXEL_OFFSET 1
				#endif
				#ifndef FXAA_FAST_PIXEL_OFFSET
						#define FXAA_FAST_PIXEL_OFFSET 0
				#endif
		#endif
		/*--------------------------------------------------------------------------*/
		#ifndef FXAA_GATHER4_ALPHA
				//
				// 1 = API supports gather4 on alpha channel.
				// 0 = API does not support gather4 on alpha channel.
				//
				#if (FXAA_HLSL_5 == 1)
						#define FXAA_GATHER4_ALPHA 1
				#endif
				#ifdef GL_ARB_gpu_shader5
						#define FXAA_GATHER4_ALPHA 1
				#endif
				#ifdef GL_NV_gpu_shader5
						#define FXAA_GATHER4_ALPHA 1
				#endif
				#ifndef FXAA_GATHER4_ALPHA
						#define FXAA_GATHER4_ALPHA 0
				#endif
		#endif


		/*============================================================================
														FXAA QUALITY - TUNING KNOBS
		------------------------------------------------------------------------------
		NOTE the other tuning knobs are now in the shader function inputs!
		============================================================================*/
		#ifndef FXAA_QUALITY_PRESET
				//
				// Choose the quality preset.
				// This needs to be compiled into the shader as it effects code.
				// Best option to include multiple presets is to
				// in each shader define the preset, then include this file.
				//
				// OPTIONS
				// -----------------------------------------------------------------------
				// 10 to 15 - default medium dither (10=fastest, 15=highest quality)
				// 20 to 29 - less dither, more expensive (20=fastest, 29=highest quality)
				// 39			 - no dither, very expensive
				//
				// NOTES
				// -----------------------------------------------------------------------
				// 12 = slightly faster then FXAA 3.9 and higher edge quality (default)
				// 13 = about same speed as FXAA 3.9 and better than 12
				// 23 = closest to FXAA 3.9 visually and performance wise
				//	_ = the lowest digit is directly related to performance
				// _	= the highest digit is directly related to style
				//
				#define FXAA_QUALITY_PRESET 12
		#endif


		/*============================================================================

															 FXAA QUALITY - PRESETS

		============================================================================*/

		/*============================================================================
												 FXAA QUALITY - MEDIUM DITHER PRESETS
		============================================================================*/
		#if (FXAA_QUALITY_PRESET == 10)
				#define FXAA_QUALITY_PS 3
				#define FXAA_QUALITY_P0 1.5
				#define FXAA_QUALITY_P1 3.0
				#define FXAA_QUALITY_P2 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 11)
				#define FXAA_QUALITY_PS 4
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 3.0
				#define FXAA_QUALITY_P3 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 12)
				#define FXAA_QUALITY_PS 5
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 4.0
				#define FXAA_QUALITY_P4 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 13)
				#define FXAA_QUALITY_PS 6
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 4.0
				#define FXAA_QUALITY_P5 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 14)
				#define FXAA_QUALITY_PS 7
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 4.0
				#define FXAA_QUALITY_P6 12.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 15)
				#define FXAA_QUALITY_PS 8
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 4.0
				#define FXAA_QUALITY_P7 12.0
		#endif

		/*============================================================================
												 FXAA QUALITY - LOW DITHER PRESETS
		============================================================================*/
		#if (FXAA_QUALITY_PRESET == 20)
				#define FXAA_QUALITY_PS 3
				#define FXAA_QUALITY_P0 1.5
				#define FXAA_QUALITY_P1 2.0
				#define FXAA_QUALITY_P2 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 21)
				#define FXAA_QUALITY_PS 4
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 22)
				#define FXAA_QUALITY_PS 5
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 23)
				#define FXAA_QUALITY_PS 6
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 24)
				#define FXAA_QUALITY_PS 7
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 3.0
				#define FXAA_QUALITY_P6 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 25)
				#define FXAA_QUALITY_PS 8
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 4.0
				#define FXAA_QUALITY_P7 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 26)
				#define FXAA_QUALITY_PS 9
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 4.0
				#define FXAA_QUALITY_P8 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 27)
				#define FXAA_QUALITY_PS 10
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 4.0
				#define FXAA_QUALITY_P9 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 28)
				#define FXAA_QUALITY_PS 11
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 2.0
				#define FXAA_QUALITY_P9 4.0
				#define FXAA_QUALITY_P10 8.0
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_QUALITY_PRESET == 29)
				#define FXAA_QUALITY_PS 12
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.5
				#define FXAA_QUALITY_P2 2.0
				#define FXAA_QUALITY_P3 2.0
				#define FXAA_QUALITY_P4 2.0
				#define FXAA_QUALITY_P5 2.0
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 2.0
				#define FXAA_QUALITY_P9 2.0
				#define FXAA_QUALITY_P10 4.0
				#define FXAA_QUALITY_P11 8.0
		#endif

		/*============================================================================
												 FXAA QUALITY - EXTREME QUALITY
		============================================================================*/
		#if (FXAA_QUALITY_PRESET == 39)
				#define FXAA_QUALITY_PS 12
				#define FXAA_QUALITY_P0 1.0
				#define FXAA_QUALITY_P1 1.0
				#define FXAA_QUALITY_P2 1.0
				#define FXAA_QUALITY_P3 1.0
				#define FXAA_QUALITY_P4 1.0
				#define FXAA_QUALITY_P5 1.5
				#define FXAA_QUALITY_P6 2.0
				#define FXAA_QUALITY_P7 2.0
				#define FXAA_QUALITY_P8 2.0
				#define FXAA_QUALITY_P9 2.0
				#define FXAA_QUALITY_P10 4.0
				#define FXAA_QUALITY_P11 8.0
		#endif



		/*============================================================================

																		API PORTING

		============================================================================*/
		#if (FXAA_GLSL_100 == 1) || (FXAA_GLSL_120 == 1) || (FXAA_GLSL_130 == 1)
				#define FxaaBool bool
				#define FxaaDiscard discard
				#define FxaaFloat float
				#define FxaaFloat2 vec2
				#define FxaaFloat3 vec3
				#define FxaaFloat4 vec4
				#define FxaaHalf float
				#define FxaaHalf2 vec2
				#define FxaaHalf3 vec3
				#define FxaaHalf4 vec4
				#define FxaaInt2 ivec2
				#define FxaaSat(x) clamp(x, 0.0, 1.0)
				#define FxaaTex sampler2D
		#else
				#define FxaaBool bool
				#define FxaaDiscard clip(-1)
				#define FxaaFloat float
				#define FxaaFloat2 float2
				#define FxaaFloat3 float3
				#define FxaaFloat4 float4
				#define FxaaHalf half
				#define FxaaHalf2 half2
				#define FxaaHalf3 half3
				#define FxaaHalf4 half4
				#define FxaaSat(x) saturate(x)
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_GLSL_100 == 1)
			#define FxaaTexTop(t, p) texture2D(t, p, 0.0)
			#define FxaaTexOff(t, p, o, r) texture2D(t, p + (o * r), 0.0)
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_GLSL_120 == 1)
				// Requires,
				//	#version 120
				// And at least,
				//	#extension GL_EXT_gpu_shader4 : enable
				//	(or set FXAA_FAST_PIXEL_OFFSET 1 to work like DX9)
				#define FxaaTexTop(t, p) texture2DLod(t, p, 0.0)
				#if (FXAA_FAST_PIXEL_OFFSET == 1)
						#define FxaaTexOff(t, p, o, r) texture2DLodOffset(t, p, 0.0, o)
				#else
						#define FxaaTexOff(t, p, o, r) texture2DLod(t, p + (o * r), 0.0)
				#endif
				#if (FXAA_GATHER4_ALPHA == 1)
						// use #extension GL_ARB_gpu_shader5 : enable
						#define FxaaTexAlpha4(t, p) textureGather(t, p, 3)
						#define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)
						#define FxaaTexGreen4(t, p) textureGather(t, p, 1)
						#define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)
				#endif
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_GLSL_130 == 1)
				// Requires "#version 130" or better
				#define FxaaTexTop(t, p) textureLod(t, p, 0.0)
				#define FxaaTexOff(t, p, o, r) textureLodOffset(t, p, 0.0, o)
				#if (FXAA_GATHER4_ALPHA == 1)
						// use #extension GL_ARB_gpu_shader5 : enable
						#define FxaaTexAlpha4(t, p) textureGather(t, p, 3)
						#define FxaaTexOffAlpha4(t, p, o) textureGatherOffset(t, p, o, 3)
						#define FxaaTexGreen4(t, p) textureGather(t, p, 1)
						#define FxaaTexOffGreen4(t, p, o) textureGatherOffset(t, p, o, 1)
				#endif
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_HLSL_3 == 1)
				#define FxaaInt2 float2
				#define FxaaTex sampler2D
				#define FxaaTexTop(t, p) tex2Dlod(t, float4(p, 0.0, 0.0))
				#define FxaaTexOff(t, p, o, r) tex2Dlod(t, float4(p + (o * r), 0, 0))
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_HLSL_4 == 1)
				#define FxaaInt2 int2
				struct FxaaTex { SamplerState smpl; Texture2D tex; };
				#define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)
				#define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)
		#endif
		/*--------------------------------------------------------------------------*/
		#if (FXAA_HLSL_5 == 1)
				#define FxaaInt2 int2
				struct FxaaTex { SamplerState smpl; Texture2D tex; };
				#define FxaaTexTop(t, p) t.tex.SampleLevel(t.smpl, p, 0.0)
				#define FxaaTexOff(t, p, o, r) t.tex.SampleLevel(t.smpl, p, 0.0, o)
				#define FxaaTexAlpha4(t, p) t.tex.GatherAlpha(t.smpl, p)
				#define FxaaTexOffAlpha4(t, p, o) t.tex.GatherAlpha(t.smpl, p, o)
				#define FxaaTexGreen4(t, p) t.tex.GatherGreen(t.smpl, p)
				#define FxaaTexOffGreen4(t, p, o) t.tex.GatherGreen(t.smpl, p, o)
		#endif


		/*============================================================================
											 GREEN AS LUMA OPTION SUPPORT FUNCTION
		============================================================================*/
		#if (FXAA_GREEN_AS_LUMA == 0)
				FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.w; }
		#else
				FxaaFloat FxaaLuma(FxaaFloat4 rgba) { return rgba.y; }
		#endif




		/*============================================================================

																 FXAA3 QUALITY - PC

		============================================================================*/
		#if (FXAA_PC == 1)
		/*--------------------------------------------------------------------------*/
		FxaaFloat4 FxaaPixelShader(
				//
				// Use noperspective interpolation here (turn off perspective interpolation).
				// {xy} = center of pixel
				FxaaFloat2 pos,
				//
				// Used only for FXAA Console, and not used on the 360 version.
				// Use noperspective interpolation here (turn off perspective interpolation).
				// {xy_} = upper left of pixel
				// {_zw} = lower right of pixel
				FxaaFloat4 fxaaConsolePosPos,
				//
				// Input color texture.
				// {rgb_} = color in linear or perceptual color space
				// if (FXAA_GREEN_AS_LUMA == 0)
				//		 {__a} = luma in perceptual color space (not linear)
				FxaaTex tex,
				//
				// Only used on the optimized 360 version of FXAA Console.
				// For everything but 360, just use the same input here as for "tex".
				// For 360, same texture, just alias with a 2nd sampler.
				// This sampler needs to have an exponent bias of -1.
				FxaaTex fxaaConsole360TexExpBiasNegOne,
				//
				// Only used on the optimized 360 version of FXAA Console.
				// For everything but 360, just use the same input here as for "tex".
				// For 360, same texture, just alias with a 3nd sampler.
				// This sampler needs to have an exponent bias of -2.
				FxaaTex fxaaConsole360TexExpBiasNegTwo,
				//
				// Only used on FXAA Quality.
				// This must be from a constant/uniform.
				// {x_} = 1.0/screenWidthInPixels
				// {_y} = 1.0/screenHeightInPixels
				FxaaFloat2 fxaaQualityRcpFrame,
				//
				// Only used on FXAA Console.
				// This must be from a constant/uniform.
				// This effects sub-pixel AA quality and inversely sharpness.
				//	 Where N ranges between,
				//		 N = 0.50 (default)
				//		 N = 0.33 (sharper)
				// {x__} = -N/screenWidthInPixels
				// {_y_} = -N/screenHeightInPixels
				// {_z_} =	N/screenWidthInPixels
				// {__w} =	N/screenHeightInPixels
				FxaaFloat4 fxaaConsoleRcpFrameOpt,
				//
				// Only used on FXAA Console.
				// Not used on 360, but used on PS3 and PC.
				// This must be from a constant/uniform.
				// {x__} = -2.0/screenWidthInPixels
				// {_y_} = -2.0/screenHeightInPixels
				// {_z_} =	2.0/screenWidthInPixels
				// {__w} =	2.0/screenHeightInPixels
				FxaaFloat4 fxaaConsoleRcpFrameOpt2,
				//
				// Only used on FXAA Console.
				// Only used on 360 in place of fxaaConsoleRcpFrameOpt2.
				// This must be from a constant/uniform.
				// {x__} =	8.0/screenWidthInPixels
				// {_y_} =	8.0/screenHeightInPixels
				// {_z_} = -4.0/screenWidthInPixels
				// {__w} = -4.0/screenHeightInPixels
				FxaaFloat4 fxaaConsole360RcpFrameOpt2,
				//
				// Only used on FXAA Quality.
				// This used to be the FXAA_QUALITY_SUBPIX define.
				// It is here now to allow easier tuning.
				// Choose the amount of sub-pixel aliasing removal.
				// This can effect sharpness.
				//	 1.00 - upper limit (softer)
				//	 0.75 - default amount of filtering
				//	 0.50 - lower limit (sharper, less sub-pixel aliasing removal)
				//	 0.25 - almost off
				//	 0.00 - completely off
				FxaaFloat fxaaQualitySubpix,
				//
				// Only used on FXAA Quality.
				// This used to be the FXAA_QUALITY_EDGE_THRESHOLD define.
				// It is here now to allow easier tuning.
				// The minimum amount of local contrast required to apply algorithm.
				//	 0.333 - too little (faster)
				//	 0.250 - low quality
				//	 0.166 - default
				//	 0.125 - high quality
				//	 0.063 - overkill (slower)
				FxaaFloat fxaaQualityEdgeThreshold,
				//
				// Only used on FXAA Quality.
				// This used to be the FXAA_QUALITY_EDGE_THRESHOLD_MIN define.
				// It is here now to allow easier tuning.
				// Trims the algorithm from processing darks.
				//	 0.0833 - upper limit (default, the start of visible unfiltered edges)
				//	 0.0625 - high quality (faster)
				//	 0.0312 - visible limit (slower)
				// Special notes when using FXAA_GREEN_AS_LUMA,
				//	 Likely want to set this to zero.
				//	 As colors that are mostly not-green
				//	 will appear very dark in the green channel!
				//	 Tune by looking at mostly non-green content,
				//	 then start at zero and increase until aliasing is a problem.
				FxaaFloat fxaaQualityEdgeThresholdMin,
				//
				// Only used on FXAA Console.
				// This used to be the FXAA_CONSOLE_EDGE_SHARPNESS define.
				// It is here now to allow easier tuning.
				// This does not effect PS3, as this needs to be compiled in.
				//	 Use FXAA_CONSOLE_PS3_EDGE_SHARPNESS for PS3.
				//	 Due to the PS3 being ALU bound,
				//	 there are only three safe values here: 2 and 4 and 8.
				//	 These options use the shaders ability to a free *|/ by 2|4|8.
				// For all other platforms can be a non-power of two.
				//	 8.0 is sharper (default!!!)
				//	 4.0 is softer
				//	 2.0 is really soft (good only for vector graphics inputs)
				FxaaFloat fxaaConsoleEdgeSharpness,
				//
				// Only used on FXAA Console.
				// This used to be the FXAA_CONSOLE_EDGE_THRESHOLD define.
				// It is here now to allow easier tuning.
				// This does not effect PS3, as this needs to be compiled in.
				//	 Use FXAA_CONSOLE_PS3_EDGE_THRESHOLD for PS3.
				//	 Due to the PS3 being ALU bound,
				//	 there are only two safe values here: 1/4 and 1/8.
				//	 These options use the shaders ability to a free *|/ by 2|4|8.
				// The console setting has a different mapping than the quality setting.
				// Other platforms can use other values.
				//	 0.125 leaves less aliasing, but is softer (default!!!)
				//	 0.25 leaves more aliasing, and is sharper
				FxaaFloat fxaaConsoleEdgeThreshold,
				//
				// Only used on FXAA Console.
				// This used to be the FXAA_CONSOLE_EDGE_THRESHOLD_MIN define.
				// It is here now to allow easier tuning.
				// Trims the algorithm from processing darks.
				// The console setting has a different mapping than the quality setting.
				// This only applies when FXAA_EARLY_EXIT is 1.
				// This does not apply to PS3,
				// PS3 was simplified to avoid more shader instructions.
				//	 0.06 - faster but more aliasing in darks
				//	 0.05 - default
				//	 0.04 - slower and less aliasing in darks
				// Special notes when using FXAA_GREEN_AS_LUMA,
				//	 Likely want to set this to zero.
				//	 As colors that are mostly not-green
				//	 will appear very dark in the green channel!
				//	 Tune by looking at mostly non-green content,
				//	 then start at zero and increase until aliasing is a problem.
				FxaaFloat fxaaConsoleEdgeThresholdMin,
				//
				// Extra constants for 360 FXAA Console only.
				// Use zeros or anything else for other platforms.
				// These must be in physical constant registers and NOT immediates.
				// Immediates will result in compiler un-optimizing.
				// {xyzw} = float4(1.0, -1.0, 0.25, -0.25)
				FxaaFloat4 fxaaConsole360ConstDir
		) {
		/*--------------------------------------------------------------------------*/
				FxaaFloat2 posM;
				posM.x = pos.x;
				posM.y = pos.y;
				#if (FXAA_GATHER4_ALPHA == 1)
						#if (FXAA_DISCARD == 0)
								FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);
								#if (FXAA_GREEN_AS_LUMA == 0)
										#define lumaM rgbyM.w
								#else
										#define lumaM rgbyM.y
								#endif
						#endif
						#if (FXAA_GREEN_AS_LUMA == 0)
								FxaaFloat4 luma4A = FxaaTexAlpha4(tex, posM);
								FxaaFloat4 luma4B = FxaaTexOffAlpha4(tex, posM, FxaaInt2(-1, -1));
						#else
								FxaaFloat4 luma4A = FxaaTexGreen4(tex, posM);
								FxaaFloat4 luma4B = FxaaTexOffGreen4(tex, posM, FxaaInt2(-1, -1));
						#endif
						#if (FXAA_DISCARD == 1)
								#define lumaM luma4A.w
						#endif
						#define lumaE luma4A.z
						#define lumaS luma4A.x
						#define lumaSE luma4A.y
						#define lumaNW luma4B.w
						#define lumaN luma4B.z
						#define lumaW luma4B.x
				#else
						FxaaFloat4 rgbyM = FxaaTexTop(tex, posM);
						#if (FXAA_GREEN_AS_LUMA == 0)
								#define lumaM rgbyM.w
						#else
								#define lumaM rgbyM.y
						#endif
						#if (FXAA_GLSL_100 == 1)
							FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0, 1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 0.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 0.0,-1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 0.0), fxaaQualityRcpFrame.xy));
						#else
							FxaaFloat lumaS = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0, 1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaN = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 0,-1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 0), fxaaQualityRcpFrame.xy));
						#endif
				#endif
		/*--------------------------------------------------------------------------*/
				FxaaFloat maxSM = max(lumaS, lumaM);
				FxaaFloat minSM = min(lumaS, lumaM);
				FxaaFloat maxESM = max(lumaE, maxSM);
				FxaaFloat minESM = min(lumaE, minSM);
				FxaaFloat maxWN = max(lumaN, lumaW);
				FxaaFloat minWN = min(lumaN, lumaW);
				FxaaFloat rangeMax = max(maxWN, maxESM);
				FxaaFloat rangeMin = min(minWN, minESM);
				FxaaFloat rangeMaxScaled = rangeMax * fxaaQualityEdgeThreshold;
				FxaaFloat range = rangeMax - rangeMin;
				FxaaFloat rangeMaxClamped = max(fxaaQualityEdgeThresholdMin, rangeMaxScaled);
				FxaaBool earlyExit = range < rangeMaxClamped;
		/*--------------------------------------------------------------------------*/
				if(earlyExit)
						#if (FXAA_DISCARD == 1)
								FxaaDiscard;
						#else
								return rgbyM;
						#endif
		/*--------------------------------------------------------------------------*/
				#if (FXAA_GATHER4_ALPHA == 0)
						#if (FXAA_GLSL_100 == 1)
							FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0,-1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0, 1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2( 1.0,-1.0), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaFloat2(-1.0, 1.0), fxaaQualityRcpFrame.xy));
						#else
							FxaaFloat lumaNW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1,-1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1, 1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2( 1,-1), fxaaQualityRcpFrame.xy));
							FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));
						#endif
				#else
						FxaaFloat lumaNE = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(1, -1), fxaaQualityRcpFrame.xy));
						FxaaFloat lumaSW = FxaaLuma(FxaaTexOff(tex, posM, FxaaInt2(-1, 1), fxaaQualityRcpFrame.xy));
				#endif
		/*--------------------------------------------------------------------------*/
				FxaaFloat lumaNS = lumaN + lumaS;
				FxaaFloat lumaWE = lumaW + lumaE;
				FxaaFloat subpixRcpRange = 1.0/range;
				FxaaFloat subpixNSWE = lumaNS + lumaWE;
				FxaaFloat edgeHorz1 = (-2.0 * lumaM) + lumaNS;
				FxaaFloat edgeVert1 = (-2.0 * lumaM) + lumaWE;
		/*--------------------------------------------------------------------------*/
				FxaaFloat lumaNESE = lumaNE + lumaSE;
				FxaaFloat lumaNWNE = lumaNW + lumaNE;
				FxaaFloat edgeHorz2 = (-2.0 * lumaE) + lumaNESE;
				FxaaFloat edgeVert2 = (-2.0 * lumaN) + lumaNWNE;
		/*--------------------------------------------------------------------------*/
				FxaaFloat lumaNWSW = lumaNW + lumaSW;
				FxaaFloat lumaSWSE = lumaSW + lumaSE;
				FxaaFloat edgeHorz4 = (abs(edgeHorz1) * 2.0) + abs(edgeHorz2);
				FxaaFloat edgeVert4 = (abs(edgeVert1) * 2.0) + abs(edgeVert2);
				FxaaFloat edgeHorz3 = (-2.0 * lumaW) + lumaNWSW;
				FxaaFloat edgeVert3 = (-2.0 * lumaS) + lumaSWSE;
				FxaaFloat edgeHorz = abs(edgeHorz3) + edgeHorz4;
				FxaaFloat edgeVert = abs(edgeVert3) + edgeVert4;
		/*--------------------------------------------------------------------------*/
				FxaaFloat subpixNWSWNESE = lumaNWSW + lumaNESE;
				FxaaFloat lengthSign = fxaaQualityRcpFrame.x;
				FxaaBool horzSpan = edgeHorz >= edgeVert;
				FxaaFloat subpixA = subpixNSWE * 2.0 + subpixNWSWNESE;
		/*--------------------------------------------------------------------------*/
				if(!horzSpan) lumaN = lumaW;
				if(!horzSpan) lumaS = lumaE;
				if(horzSpan) lengthSign = fxaaQualityRcpFrame.y;
				FxaaFloat subpixB = (subpixA * (1.0/12.0)) - lumaM;
		/*--------------------------------------------------------------------------*/
				FxaaFloat gradientN = lumaN - lumaM;
				FxaaFloat gradientS = lumaS - lumaM;
				FxaaFloat lumaNN = lumaN + lumaM;
				FxaaFloat lumaSS = lumaS + lumaM;
				FxaaBool pairN = abs(gradientN) >= abs(gradientS);
				FxaaFloat gradient = max(abs(gradientN), abs(gradientS));
				if(pairN) lengthSign = -lengthSign;
				FxaaFloat subpixC = FxaaSat(abs(subpixB) * subpixRcpRange);
		/*--------------------------------------------------------------------------*/
				FxaaFloat2 posB;
				posB.x = posM.x;
				posB.y = posM.y;
				FxaaFloat2 offNP;
				offNP.x = (!horzSpan) ? 0.0 : fxaaQualityRcpFrame.x;
				offNP.y = ( horzSpan) ? 0.0 : fxaaQualityRcpFrame.y;
				if(!horzSpan) posB.x += lengthSign * 0.5;
				if( horzSpan) posB.y += lengthSign * 0.5;
		/*--------------------------------------------------------------------------*/
				FxaaFloat2 posN;
				posN.x = posB.x - offNP.x * FXAA_QUALITY_P0;
				posN.y = posB.y - offNP.y * FXAA_QUALITY_P0;
				FxaaFloat2 posP;
				posP.x = posB.x + offNP.x * FXAA_QUALITY_P0;
				posP.y = posB.y + offNP.y * FXAA_QUALITY_P0;
				FxaaFloat subpixD = ((-2.0)*subpixC) + 3.0;
				FxaaFloat lumaEndN = FxaaLuma(FxaaTexTop(tex, posN));
				FxaaFloat subpixE = subpixC * subpixC;
				FxaaFloat lumaEndP = FxaaLuma(FxaaTexTop(tex, posP));
		/*--------------------------------------------------------------------------*/
				if(!pairN) lumaNN = lumaSS;
				FxaaFloat gradientScaled = gradient * 1.0/4.0;
				FxaaFloat lumaMM = lumaM - lumaNN * 0.5;
				FxaaFloat subpixF = subpixD * subpixE;
				FxaaBool lumaMLTZero = lumaMM < 0.0;
		/*--------------------------------------------------------------------------*/
				lumaEndN -= lumaNN * 0.5;
				lumaEndP -= lumaNN * 0.5;
				FxaaBool doneN = abs(lumaEndN) >= gradientScaled;
				FxaaBool doneP = abs(lumaEndP) >= gradientScaled;
				if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P1;
				if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P1;
				FxaaBool doneNP = (!doneN) || (!doneP);
				if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P1;
				if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P1;
		/*--------------------------------------------------------------------------*/
				if(doneNP) {
						if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
						if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
						if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
						if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
						doneN = abs(lumaEndN) >= gradientScaled;
						doneP = abs(lumaEndP) >= gradientScaled;
						if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P2;
						if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P2;
						doneNP = (!doneN) || (!doneP);
						if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P2;
						if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P2;
		/*--------------------------------------------------------------------------*/
						#if (FXAA_QUALITY_PS > 3)
						if(doneNP) {
								if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
								if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
								if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
								if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
								doneN = abs(lumaEndN) >= gradientScaled;
								doneP = abs(lumaEndP) >= gradientScaled;
								if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P3;
								if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P3;
								doneNP = (!doneN) || (!doneP);
								if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P3;
								if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P3;
		/*--------------------------------------------------------------------------*/
								#if (FXAA_QUALITY_PS > 4)
								if(doneNP) {
										if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
										if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
										if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
										if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
										doneN = abs(lumaEndN) >= gradientScaled;
										doneP = abs(lumaEndP) >= gradientScaled;
										if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P4;
										if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P4;
										doneNP = (!doneN) || (!doneP);
										if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P4;
										if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P4;
		/*--------------------------------------------------------------------------*/
										#if (FXAA_QUALITY_PS > 5)
										if(doneNP) {
												if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
												if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
												if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
												if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
												doneN = abs(lumaEndN) >= gradientScaled;
												doneP = abs(lumaEndP) >= gradientScaled;
												if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P5;
												if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P5;
												doneNP = (!doneN) || (!doneP);
												if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P5;
												if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P5;
		/*--------------------------------------------------------------------------*/
												#if (FXAA_QUALITY_PS > 6)
												if(doneNP) {
														if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
														if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
														if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
														if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
														doneN = abs(lumaEndN) >= gradientScaled;
														doneP = abs(lumaEndP) >= gradientScaled;
														if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P6;
														if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P6;
														doneNP = (!doneN) || (!doneP);
														if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P6;
														if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P6;
		/*--------------------------------------------------------------------------*/
														#if (FXAA_QUALITY_PS > 7)
														if(doneNP) {
																if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
																if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
																if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
																if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
																doneN = abs(lumaEndN) >= gradientScaled;
																doneP = abs(lumaEndP) >= gradientScaled;
																if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P7;
																if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P7;
																doneNP = (!doneN) || (!doneP);
																if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P7;
																if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P7;
		/*--------------------------------------------------------------------------*/
				#if (FXAA_QUALITY_PS > 8)
				if(doneNP) {
						if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
						if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
						if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
						if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
						doneN = abs(lumaEndN) >= gradientScaled;
						doneP = abs(lumaEndP) >= gradientScaled;
						if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P8;
						if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P8;
						doneNP = (!doneN) || (!doneP);
						if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P8;
						if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P8;
		/*--------------------------------------------------------------------------*/
						#if (FXAA_QUALITY_PS > 9)
						if(doneNP) {
								if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
								if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
								if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
								if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
								doneN = abs(lumaEndN) >= gradientScaled;
								doneP = abs(lumaEndP) >= gradientScaled;
								if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P9;
								if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P9;
								doneNP = (!doneN) || (!doneP);
								if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P9;
								if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P9;
		/*--------------------------------------------------------------------------*/
								#if (FXAA_QUALITY_PS > 10)
								if(doneNP) {
										if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
										if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
										if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
										if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
										doneN = abs(lumaEndN) >= gradientScaled;
										doneP = abs(lumaEndP) >= gradientScaled;
										if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P10;
										if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P10;
										doneNP = (!doneN) || (!doneP);
										if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P10;
										if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P10;
		/*--------------------------------------------------------------------------*/
										#if (FXAA_QUALITY_PS > 11)
										if(doneNP) {
												if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
												if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
												if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
												if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
												doneN = abs(lumaEndN) >= gradientScaled;
												doneP = abs(lumaEndP) >= gradientScaled;
												if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P11;
												if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P11;
												doneNP = (!doneN) || (!doneP);
												if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P11;
												if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P11;
		/*--------------------------------------------------------------------------*/
												#if (FXAA_QUALITY_PS > 12)
												if(doneNP) {
														if(!doneN) lumaEndN = FxaaLuma(FxaaTexTop(tex, posN.xy));
														if(!doneP) lumaEndP = FxaaLuma(FxaaTexTop(tex, posP.xy));
														if(!doneN) lumaEndN = lumaEndN - lumaNN * 0.5;
														if(!doneP) lumaEndP = lumaEndP - lumaNN * 0.5;
														doneN = abs(lumaEndN) >= gradientScaled;
														doneP = abs(lumaEndP) >= gradientScaled;
														if(!doneN) posN.x -= offNP.x * FXAA_QUALITY_P12;
														if(!doneN) posN.y -= offNP.y * FXAA_QUALITY_P12;
														doneNP = (!doneN) || (!doneP);
														if(!doneP) posP.x += offNP.x * FXAA_QUALITY_P12;
														if(!doneP) posP.y += offNP.y * FXAA_QUALITY_P12;
		/*--------------------------------------------------------------------------*/
												}
												#endif
		/*--------------------------------------------------------------------------*/
										}
										#endif
		/*--------------------------------------------------------------------------*/
								}
								#endif
		/*--------------------------------------------------------------------------*/
						}
						#endif
		/*--------------------------------------------------------------------------*/
				}
				#endif
		/*--------------------------------------------------------------------------*/
														}
														#endif
		/*--------------------------------------------------------------------------*/
												}
												#endif
		/*--------------------------------------------------------------------------*/
										}
										#endif
		/*--------------------------------------------------------------------------*/
								}
								#endif
		/*--------------------------------------------------------------------------*/
						}
						#endif
		/*--------------------------------------------------------------------------*/
				}
		/*--------------------------------------------------------------------------*/
				FxaaFloat dstN = posM.x - posN.x;
				FxaaFloat dstP = posP.x - posM.x;
				if(!horzSpan) dstN = posM.y - posN.y;
				if(!horzSpan) dstP = posP.y - posM.y;
		/*--------------------------------------------------------------------------*/
				FxaaBool goodSpanN = (lumaEndN < 0.0) != lumaMLTZero;
				FxaaFloat spanLength = (dstP + dstN);
				FxaaBool goodSpanP = (lumaEndP < 0.0) != lumaMLTZero;
				FxaaFloat spanLengthRcp = 1.0/spanLength;
		/*--------------------------------------------------------------------------*/
				FxaaBool directionN = dstN < dstP;
				FxaaFloat dst = min(dstN, dstP);
				FxaaBool goodSpan = directionN ? goodSpanN : goodSpanP;
				FxaaFloat subpixG = subpixF * subpixF;
				FxaaFloat pixelOffset = (dst * (-spanLengthRcp)) + 0.5;
				FxaaFloat subpixH = subpixG * fxaaQualitySubpix;
		/*--------------------------------------------------------------------------*/
				FxaaFloat pixelOffsetGood = goodSpan ? pixelOffset : 0.0;
				FxaaFloat pixelOffsetSubpix = max(pixelOffsetGood, subpixH);
				if(!horzSpan) posM.x += pixelOffsetSubpix * lengthSign;
				if( horzSpan) posM.y += pixelOffsetSubpix * lengthSign;
				#if (FXAA_DISCARD == 1)
						return FxaaTexTop(tex, posM);
				#else
						return FxaaFloat4(FxaaTexTop(tex, posM).xyz, lumaM);
				#endif
		}
		/*==========================================================================*/
		#endif

		void main() {
			gl_FragColor = FxaaPixelShader(
				vUv,
				vec4(0.0),
				tDiffuse,
				tDiffuse,
				tDiffuse,
				resolution,
				vec4(0.0),
				vec4(0.0),
				vec4(0.0),
				0.75,
				0.166,
				0.0833,
				0.0,
				0.0,
				0.0,
				vec4(0.0)
			);

			// TODO avoid querying texture twice for same texel
			gl_FragColor.a = texture2D(tDiffuse, vUv).a;
		}`
};
THREE.FXAAShader=FXAAShader;
})();
(function(){
class SimplexNoise{
constructor(r=Math){
this.grad3=[[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
this.grad4=[[0,1,1,1],[0,1,1,-1],[0,1,-1,1],[0,1,-1,-1],[0,-1,1,1],[0,-1,1,-1],[0,-1,-1,1],[0,-1,-1,-1],[1,0,1,1],[1,0,1,-1],[1,0,-1,1],[1,0,-1,-1],[-1,0,1,1],[-1,0,1,-1],[-1,0,-1,1],[-1,0,-1,-1],[1,1,0,1],[1,1,0,-1],[1,-1,0,1],[1,-1,0,-1],[-1,1,0,1],[-1,1,0,-1],[-1,-1,0,1],[-1,-1,0,-1],[1,1,1,0],[1,1,-1,0],[1,-1,1,0],[1,-1,-1,0],[-1,1,1,0],[-1,1,-1,0],[-1,-1,1,0],[-1,-1,-1,0]];
this.p=[];
for(let i=0;i<256;i++){
this.p[i]=Math.floor(r.random()*256);
}
this.perm=[];
for(let i=0;i<512;i++){
this.perm[i]=this.p[i&255];
}
this.simplex=[[0,1,2,3],[0,1,3,2],[0,0,0,0],[0,2,3,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,3,0],[0,2,1,3],[0,0,0,0],[0,3,1,2],[0,3,2,1],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,3,2,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[1,2,0,3],[0,0,0,0],[1,3,0,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,3,0,1],[2,3,1,0],[1,0,2,3],[1,0,3,2],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,3,1],[0,0,0,0],[2,1,3,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[0,0,0,0],[2,0,1,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,0,1,2],[3,0,2,1],[0,0,0,0],[3,1,2,0],[2,1,0,3],[0,0,0,0],[0,0,0,0],[0,0,0,0],[3,1,0,2],[0,0,0,0],[3,2,0,1],[3,2,1,0]];
}
dot(g,x,y){
return g[0]*x+g[1]*y;
}
dot3(g,x,y,z){
return g[0]*x+g[1]*y+g[2]*z;
}
dot4(g,x,y,z,w){
return g[0]*x+g[1]*y+g[2]*z+g[3]*w;
}
noise(xin,yin){
let n0;
let n1;
let n2;
const F2=0.5*(Math.sqrt(3.0)-1.0);
const s=(xin+yin)*F2;
const i=Math.floor(xin+s);
const j=Math.floor(yin+s);
const G2=(3.0-Math.sqrt(3.0))/6.0;
const t=(i+j)*G2;
const X0=i-t;
const Y0=j-t;
const x0=xin-X0;
const y0=yin-Y0;
let i1;
let j1;
if(x0>y0){
i1=1;
j1=0;
}else{
i1=0;
j1=1;
}
const x1=x0-i1+G2;
const y1=y0-j1+G2;
const x2=x0-1.0+2.0*G2;
const y2=y0-1.0+2.0*G2;
const ii=i&255;
const jj=j&255;
const gi0=this.perm[ii+this.perm[jj]]%12;
const gi1=this.perm[ii+i1+this.perm[jj+j1]]%12;
const gi2=this.perm[ii+1+this.perm[jj+1]]%12;
let t0=0.5-x0*x0-y0*y0;
if(t0<0)n0=0.0;else{
t0*=t0;
n0=t0*t0*this.dot(this.grad3[gi0],x0,y0);
}
let t1=0.5-x1*x1-y1*y1;
if(t1<0)n1=0.0;else{
t1*=t1;
n1=t1*t1*this.dot(this.grad3[gi1],x1,y1);
}
let t2=0.5-x2*x2-y2*y2;
if(t2<0)n2=0.0;else{
t2*=t2;
n2=t2*t2*this.dot(this.grad3[gi2],x2,y2);
}
return 70.0*(n0+n1+n2);
}
noise3d(xin,yin,zin){
let n0;
let n1;
let n2;
let n3;
const F3=1.0/3.0;
const s=(xin+yin+zin)*F3;
const i=Math.floor(xin+s);
const j=Math.floor(yin+s);
const k=Math.floor(zin+s);
const G3=1.0/6.0;
const t=(i+j+k)*G3;
const X0=i-t;
const Y0=j-t;
const Z0=k-t;
const x0=xin-X0;
const y0=yin-Y0;
const z0=zin-Z0;
let i1;
let j1;
let k1;
let i2;
let j2;
let k2;
if(x0>=y0){
if(y0>=z0){
i1=1;
j1=0;
k1=0;
i2=1;
j2=1;
k2=0;
}else if(x0>=z0){
i1=1;
j1=0;
k1=0;
i2=1;
j2=0;
k2=1;
}else{
i1=0;
j1=0;
k1=1;
i2=1;
j2=0;
k2=1;
}
}else{
if(y0<z0){
i1=0;
j1=0;
k1=1;
i2=0;
j2=1;
k2=1;
}else if(x0<z0){
i1=0;
j1=1;
k1=0;
i2=0;
j2=1;
k2=1;
}else{
i1=0;
j1=1;
k1=0;
i2=1;
j2=1;
k2=0;
}
}
const x1=x0-i1+G3;
const y1=y0-j1+G3;
const z1=z0-k1+G3;
const x2=x0-i2+2.0*G3;
const y2=y0-j2+2.0*G3;
const z2=z0-k2+2.0*G3;
const x3=x0-1.0+3.0*G3;
const y3=y0-1.0+3.0*G3;
const z3=z0-1.0+3.0*G3;
const ii=i&255;
const jj=j&255;
const kk=k&255;
const gi0=this.perm[ii+this.perm[jj+this.perm[kk]]]%12;
const gi1=this.perm[ii+i1+this.perm[jj+j1+this.perm[kk+k1]]]%12;
const gi2=this.perm[ii+i2+this.perm[jj+j2+this.perm[kk+k2]]]%12;
const gi3=this.perm[ii+1+this.perm[jj+1+this.perm[kk+1]]]%12;
let t0=0.6-x0*x0-y0*y0-z0*z0;
if(t0<0)n0=0.0;else{
t0*=t0;
n0=t0*t0*this.dot3(this.grad3[gi0],x0,y0,z0);
}
let t1=0.6-x1*x1-y1*y1-z1*z1;
if(t1<0)n1=0.0;else{
t1*=t1;
n1=t1*t1*this.dot3(this.grad3[gi1],x1,y1,z1);
}
let t2=0.6-x2*x2-y2*y2-z2*z2;
if(t2<0)n2=0.0;else{
t2*=t2;
n2=t2*t2*this.dot3(this.grad3[gi2],x2,y2,z2);
}
let t3=0.6-x3*x3-y3*y3-z3*z3;
if(t3<0)n3=0.0;else{
t3*=t3;
n3=t3*t3*this.dot3(this.grad3[gi3],x3,y3,z3);
}
return 32.0*(n0+n1+n2+n3);
}
noise4d(x,y,z,w){
const grad4=this.grad4;
const simplex=this.simplex;
const perm=this.perm;
const F4=(Math.sqrt(5.0)-1.0)/4.0;
const G4=(5.0-Math.sqrt(5.0))/20.0;
let n0;
let n1;
let n2;
let n3;
let n4;
const s=(x+y+z+w)*F4;
const i=Math.floor(x+s);
const j=Math.floor(y+s);
const k=Math.floor(z+s);
const l=Math.floor(w+s);
const t=(i+j+k+l)*G4;
const X0=i-t;
const Y0=j-t;
const Z0=k-t;
const W0=l-t;
const x0=x-X0;
const y0=y-Y0;
const z0=z-Z0;
const w0=w-W0;
const c1=x0>y0?32:0;
const c2=x0>z0?16:0;
const c3=y0>z0?8:0;
const c4=x0>w0?4:0;
const c5=y0>w0?2:0;
const c6=z0>w0?1:0;
const c=c1+c2+c3+c4+c5+c6;
const i1=simplex[c][0]>=3?1:0;
const j1=simplex[c][1]>=3?1:0;
const k1=simplex[c][2]>=3?1:0;
const l1=simplex[c][3]>=3?1:0;
const i2=simplex[c][0]>=2?1:0;
const j2=simplex[c][1]>=2?1:0;
const k2=simplex[c][2]>=2?1:0;
const l2=simplex[c][3]>=2?1:0;
const i3=simplex[c][0]>=1?1:0;
const j3=simplex[c][1]>=1?1:0;
const k3=simplex[c][2]>=1?1:0;
const l3=simplex[c][3]>=1?1:0;
const x1=x0-i1+G4;
const y1=y0-j1+G4;
const z1=z0-k1+G4;
const w1=w0-l1+G4;
const x2=x0-i2+2.0*G4;
const y2=y0-j2+2.0*G4;
const z2=z0-k2+2.0*G4;
const w2=w0-l2+2.0*G4;
const x3=x0-i3+3.0*G4;
const y3=y0-j3+3.0*G4;
const z3=z0-k3+3.0*G4;
const w3=w0-l3+3.0*G4;
const x4=x0-1.0+4.0*G4;
const y4=y0-1.0+4.0*G4;
const z4=z0-1.0+4.0*G4;
const w4=w0-1.0+4.0*G4;
const ii=i&255;
const jj=j&255;
const kk=k&255;
const ll=l&255;
const gi0=perm[ii+perm[jj+perm[kk+perm[ll]]]]%32;
const gi1=perm[ii+i1+perm[jj+j1+perm[kk+k1+perm[ll+l1]]]]%32;
const gi2=perm[ii+i2+perm[jj+j2+perm[kk+k2+perm[ll+l2]]]]%32;
const gi3=perm[ii+i3+perm[jj+j3+perm[kk+k3+perm[ll+l3]]]]%32;
const gi4=perm[ii+1+perm[jj+1+perm[kk+1+perm[ll+1]]]]%32;
let t0=0.6-x0*x0-y0*y0-z0*z0-w0*w0;
if(t0<0)n0=0.0;else{
t0*=t0;
n0=t0*t0*this.dot4(grad4[gi0],x0,y0,z0,w0);
}
let t1=0.6-x1*x1-y1*y1-z1*z1-w1*w1;
if(t1<0)n1=0.0;else{
t1*=t1;
n1=t1*t1*this.dot4(grad4[gi1],x1,y1,z1,w1);
}
let t2=0.6-x2*x2-y2*y2-z2*z2-w2*w2;
if(t2<0)n2=0.0;else{
t2*=t2;
n2=t2*t2*this.dot4(grad4[gi2],x2,y2,z2,w2);
}
let t3=0.6-x3*x3-y3*y3-z3*z3-w3*w3;
if(t3<0)n3=0.0;else{
t3*=t3;
n3=t3*t3*this.dot4(grad4[gi3],x3,y3,z3,w3);
}
let t4=0.6-x4*x4-y4*y4-z4*z4-w4*w4;
if(t4<0)n4=0.0;else{
t4*=t4;
n4=t4*t4*this.dot4(grad4[gi4],x4,y4,z4,w4);
}
return 27.0*(n0+n1+n2+n3+n4);
}
}
THREE.SimplexNoise=SimplexNoise;
})();
(function(){
class EffectComposer{
constructor(renderer,renderTarget){
this.renderer=renderer;
if(renderTarget===undefined){
const parameters={
minFilter:THREE.LinearFilter,
magFilter:THREE.LinearFilter,
format:THREE.RGBAFormat
};
const size=renderer.getSize(new THREE.Vector2());
this._pixelRatio=renderer.getPixelRatio();
this._width=size.width;
this._height=size.height;
renderTarget=new THREE.WebGLRenderTarget(this._width*this._pixelRatio,this._height*this._pixelRatio,parameters);
renderTarget.texture.name='EffectComposer.rt1';
}else{
this._pixelRatio=1;
this._width=renderTarget.width;
this._height=renderTarget.height;
}
this.renderTarget1=renderTarget;
this.renderTarget2=renderTarget.clone();
this.renderTarget2.texture.name='EffectComposer.rt2';
this.writeBuffer=this.renderTarget1;
this.readBuffer=this.renderTarget2;
this.renderToScreen=true;
this.passes=[];
if(THREE.CopyShader===undefined){
console.error('THREE.EffectComposer relies on THREE.CopyShader');
}
if(THREE.ShaderPass===undefined){
console.error('THREE.EffectComposer relies on THREE.ShaderPass');
}
this.copyPass=new THREE.ShaderPass(THREE.CopyShader);
this.clock=new THREE.Clock();
}
swapBuffers(){
const tmp=this.readBuffer;
this.readBuffer=this.writeBuffer;
this.writeBuffer=tmp;
}
addPass(pass){
this.passes.push(pass);
pass.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio);
}
insertPass(pass,index){
this.passes.splice(index,0,pass);
pass.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio);
}
removePass(pass){
const index=this.passes.indexOf(pass);
if(index!== -1){
this.passes.splice(index,1);
}
}
isLastEnabledPass(passIndex){
for(let i=passIndex+1;i<this.passes.length;i++){
if(this.passes[i].enabled){
return false;
}
}
return true;
}
render(deltaTime){
if(deltaTime===undefined){
deltaTime=this.clock.getDelta();
}
const currentRenderTarget=this.renderer.getRenderTarget();
let maskActive=false;
for(let i=0,il=this.passes.length;i<il;i++){
const pass=this.passes[i];
if(pass.enabled===false)continue;
pass.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(i);
pass.render(this.renderer,this.writeBuffer,this.readBuffer,deltaTime,maskActive);
if(pass.needsSwap){
if(maskActive){
const context=this.renderer.getContext();
const stencil=this.renderer.state.buffers.stencil;
stencil.setFunc(context.NOTEQUAL,1,0xffffffff);
this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,deltaTime);
stencil.setFunc(context.EQUAL,1,0xffffffff);
}
this.swapBuffers();
}
if(THREE.MaskPass!==undefined){
if(pass instanceof THREE.MaskPass){
maskActive=true;
}else if(pass instanceof THREE.ClearMaskPass){
maskActive=false;
}
}
}
this.renderer.setRenderTarget(currentRenderTarget);
}
reset(renderTarget){
if(renderTarget===undefined){
const size=this.renderer.getSize(new THREE.Vector2());
this._pixelRatio=this.renderer.getPixelRatio();
this._width=size.width;
this._height=size.height;
renderTarget=this.renderTarget1.clone();
renderTarget.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio);
}
this.renderTarget1.dispose();
this.renderTarget2.dispose();
this.renderTarget1=renderTarget;
this.renderTarget2=renderTarget.clone();
this.writeBuffer=this.renderTarget1;
this.readBuffer=this.renderTarget2;
}
setSize(width,height){
this._width=width;
this._height=height;
const effectiveWidth=this._width*this._pixelRatio;
const effectiveHeight=this._height*this._pixelRatio;
this.renderTarget1.setSize(effectiveWidth,effectiveHeight);
this.renderTarget2.setSize(effectiveWidth,effectiveHeight);
for(let i=0;i<this.passes.length;i++){
this.passes[i].setSize(effectiveWidth,effectiveHeight);
}
}
setPixelRatio(pixelRatio){
this._pixelRatio=pixelRatio;
this.setSize(this._width,this._height);
}
}
class Pass{
constructor(){
this.enabled=true;
this.needsSwap=true;
this.clear=false;
this.renderToScreen=false;
}
setSize(){}
render(){
console.error('THREE.Pass: .render() must be implemented in derived pass.');
}
}
const _camera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
const _geometry=new THREE.BufferGeometry();
_geometry.setAttribute('position',new THREE.Float32BufferAttribute([-1,3,0,-1,-1,0,3,-1,0],3));
_geometry.setAttribute('uv',new THREE.Float32BufferAttribute([0,2,0,0,2,0],2));
class FullScreenQuad{
constructor(material){
this._mesh=new THREE.Mesh(_geometry,material);
}
dispose(){
this._mesh.geometry.dispose();
}
render(renderer){
renderer.render(this._mesh,_camera);
}
get material(){
return this._mesh.material;
}
set material(value){
this._mesh.material=value;
}
}
THREE.EffectComposer=EffectComposer;
THREE.FullScreenQuad=FullScreenQuad;
THREE.Pass=Pass;
})();
(function(){
class ShaderPass extends THREE.Pass{
constructor(shader,textureID){
super();
this.textureID=textureID!==undefined?textureID:'tDiffuse';
if(shader instanceof THREE.ShaderMaterial){
this.uniforms=shader.uniforms;
this.material=shader;
}else if(shader){
this.uniforms=THREE.UniformsUtils.clone(shader.uniforms);
this.material=new THREE.ShaderMaterial({
defines:Object.assign({},shader.defines),
uniforms:this.uniforms,
vertexShader:shader.vertexShader,
fragmentShader:shader.fragmentShader
});
}
this.fsQuad=new THREE.FullScreenQuad(this.material);
}
render(renderer,writeBuffer,readBuffer
){
if(this.uniforms[this.textureID]){
this.uniforms[this.textureID].value=readBuffer.texture;
}
this.fsQuad.material=this.material;
if(this.renderToScreen){
renderer.setRenderTarget(null);
this.fsQuad.render(renderer);
}else{
renderer.setRenderTarget(writeBuffer);
if(this.clear)renderer.clear(renderer.autoClearColor,renderer.autoClearDepth,renderer.autoClearStencil);
this.fsQuad.render(renderer);
}
}
}
THREE.ShaderPass=ShaderPass;
})();
(function(){
class SSAOPass extends THREE.Pass{
constructor(scene,camera,width,height){
super();
this.width=width!==undefined?width:512;
this.height=height!==undefined?height:512;
this.clear=true;
this.camera=camera;
this.scene=scene;
this.kernelRadius=8;
this.kernelSize=32;
this.kernel=[];
this.noiseTexture=null;
this.output=0;
this.minDistance=0.005;
this.maxDistance=0.1;
this._visibilityCache=new Map();
this.generateSampleKernel();
this.generateRandomKernelRotations();
const depthTexture=new THREE.DepthTexture();
depthTexture.type=THREE.UnsignedShortType;
this.beautyRenderTarget=new THREE.WebGLRenderTarget(this.width,this.height,{
minFilter:THREE.LinearFilter,
magFilter:THREE.LinearFilter,
format:THREE.RGBAFormat
});
this.normalRenderTarget=new THREE.WebGLRenderTarget(this.width,this.height,{
minFilter:THREE.NearestFilter,
magFilter:THREE.NearestFilter,
format:THREE.RGBAFormat,
depthTexture:depthTexture
});
this.ssaoRenderTarget=new THREE.WebGLRenderTarget(this.width,this.height,{
minFilter:THREE.LinearFilter,
magFilter:THREE.LinearFilter,
format:THREE.RGBAFormat
});
this.blurRenderTarget=this.ssaoRenderTarget.clone();
if(THREE.SSAOShader===undefined){
console.error('THREE.SSAOPass: The pass relies on THREE.SSAOShader.');
}
this.ssaoMaterial=new THREE.ShaderMaterial({
defines:Object.assign({},THREE.SSAOShader.defines),
uniforms:THREE.UniformsUtils.clone(THREE.SSAOShader.uniforms),
vertexShader:THREE.SSAOShader.vertexShader,
fragmentShader:THREE.SSAOShader.fragmentShader,
blending:THREE.NoBlending
});
this.ssaoMaterial.uniforms['tDiffuse'].value=this.beautyRenderTarget.texture;
this.ssaoMaterial.uniforms['tNormal'].value=this.normalRenderTarget.texture;
this.ssaoMaterial.uniforms['tDepth'].value=this.normalRenderTarget.depthTexture;
this.ssaoMaterial.uniforms['tNoise'].value=this.noiseTexture;
this.ssaoMaterial.uniforms['kernel'].value=this.kernel;
this.ssaoMaterial.uniforms['cameraNear'].value=this.camera.near;
this.ssaoMaterial.uniforms['cameraFar'].value=this.camera.far;
this.ssaoMaterial.uniforms['resolution'].value.set(this.width,this.height);
this.ssaoMaterial.uniforms['cameraProjectionMatrix'].value.copy(this.camera.projectionMatrix);
this.ssaoMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(this.camera.projectionMatrixInverse);
this.normalMaterial=new THREE.MeshNormalMaterial();
this.normalMaterial.blending=THREE.NoBlending;
this.blurMaterial=new THREE.ShaderMaterial({
defines:Object.assign({},THREE.SSAOBlurShader.defines),
uniforms:THREE.UniformsUtils.clone(THREE.SSAOBlurShader.uniforms),
vertexShader:THREE.SSAOBlurShader.vertexShader,
fragmentShader:THREE.SSAOBlurShader.fragmentShader
});
this.blurMaterial.uniforms['tDiffuse'].value=this.ssaoRenderTarget.texture;
this.blurMaterial.uniforms['resolution'].value.set(this.width,this.height);
this.depthRenderMaterial=new THREE.ShaderMaterial({
defines:Object.assign({},THREE.SSAODepthShader.defines),
uniforms:THREE.UniformsUtils.clone(THREE.SSAODepthShader.uniforms),
vertexShader:THREE.SSAODepthShader.vertexShader,
fragmentShader:THREE.SSAODepthShader.fragmentShader,
blending:THREE.NoBlending
});
this.depthRenderMaterial.uniforms['tDepth'].value=this.normalRenderTarget.depthTexture;
this.depthRenderMaterial.uniforms['cameraNear'].value=this.camera.near;
this.depthRenderMaterial.uniforms['cameraFar'].value=this.camera.far;
this.copyMaterial=new THREE.ShaderMaterial({
uniforms:THREE.UniformsUtils.clone(THREE.CopyShader.uniforms),
vertexShader:THREE.CopyShader.vertexShader,
fragmentShader:THREE.CopyShader.fragmentShader,
transparent:true,
depthTest:false,
depthWrite:false,
blendSrc:THREE.DstColorFactor,
blendDst:THREE.ZeroFactor,
blendEquation:THREE.AddEquation,
blendSrcAlpha:THREE.DstAlphaFactor,
blendDstAlpha:THREE.ZeroFactor,
blendEquationAlpha:THREE.AddEquation
});
this.fsQuad=new THREE.FullScreenQuad(null);
this.originalClearColor=new THREE.Color();
}
dispose(){
this.beautyRenderTarget.dispose();
this.normalRenderTarget.dispose();
this.ssaoRenderTarget.dispose();
this.blurRenderTarget.dispose();
this.normalMaterial.dispose();
this.blurMaterial.dispose();
this.copyMaterial.dispose();
this.depthRenderMaterial.dispose();
this.fsQuad.dispose();
}
render(renderer,writeBuffer
){
renderer.setRenderTarget(this.beautyRenderTarget);
renderer.clear();
renderer.render(this.scene,this.camera);
this.overrideVisibility();
this.renderOverride(renderer,this.normalMaterial,this.normalRenderTarget,0x7777ff,1.0);
this.restoreVisibility();
this.ssaoMaterial.uniforms['kernelRadius'].value=this.kernelRadius;
this.ssaoMaterial.uniforms['minDistance'].value=this.minDistance;
this.ssaoMaterial.uniforms['maxDistance'].value=this.maxDistance;
this.renderPass(renderer,this.ssaoMaterial,this.ssaoRenderTarget);
this.renderPass(renderer,this.blurMaterial,this.blurRenderTarget);
switch(this.output){
case SSAOPass.OUTPUT.SSAO:
this.copyMaterial.uniforms['tDiffuse'].value=this.ssaoRenderTarget.texture;
this.copyMaterial.blending=THREE.NoBlending;
this.renderPass(renderer,this.copyMaterial,this.renderToScreen?null:writeBuffer);
break;
case SSAOPass.OUTPUT.Blur:
this.copyMaterial.uniforms['tDiffuse'].value=this.blurRenderTarget.texture;
this.copyMaterial.blending=THREE.NoBlending;
this.renderPass(renderer,this.copyMaterial,this.renderToScreen?null:writeBuffer);
break;
case SSAOPass.OUTPUT.Beauty:
this.copyMaterial.uniforms['tDiffuse'].value=this.beautyRenderTarget.texture;
this.copyMaterial.blending=THREE.NoBlending;
this.renderPass(renderer,this.copyMaterial,this.renderToScreen?null:writeBuffer);
break;
case SSAOPass.OUTPUT.Depth:
this.renderPass(renderer,this.depthRenderMaterial,this.renderToScreen?null:writeBuffer);
break;
case SSAOPass.OUTPUT.Normal:
this.copyMaterial.uniforms['tDiffuse'].value=this.normalRenderTarget.texture;
this.copyMaterial.blending=THREE.NoBlending;
this.renderPass(renderer,this.copyMaterial,this.renderToScreen?null:writeBuffer);
break;
case SSAOPass.OUTPUT.Default:
this.copyMaterial.uniforms['tDiffuse'].value=this.beautyRenderTarget.texture;
this.copyMaterial.blending=THREE.NoBlending;
this.renderPass(renderer,this.copyMaterial,this.renderToScreen?null:writeBuffer);
this.copyMaterial.uniforms['tDiffuse'].value=this.blurRenderTarget.texture;
this.copyMaterial.blending=THREE.CustomBlending;
this.renderPass(renderer,this.copyMaterial,this.renderToScreen?null:writeBuffer);
break;
default:
console.warn('THREE.SSAOPass: Unknown output type.');
}
}
renderPass(renderer,passMaterial,renderTarget,clearColor,clearAlpha){
renderer.getClearColor(this.originalClearColor);
const originalClearAlpha=renderer.getClearAlpha();
const originalAutoClear=renderer.autoClear;
renderer.setRenderTarget(renderTarget);
renderer.autoClear=false;
if(clearColor!==undefined&&clearColor!==null){
renderer.setClearColor(clearColor);
renderer.setClearAlpha(clearAlpha||0.0);
renderer.clear();
}
this.fsQuad.material=passMaterial;
this.fsQuad.render(renderer);
renderer.autoClear=originalAutoClear;
renderer.setClearColor(this.originalClearColor);
renderer.setClearAlpha(originalClearAlpha);
}
renderOverride(renderer,overrideMaterial,renderTarget,clearColor,clearAlpha){
renderer.getClearColor(this.originalClearColor);
const originalClearAlpha=renderer.getClearAlpha();
const originalAutoClear=renderer.autoClear;
renderer.setRenderTarget(renderTarget);
renderer.autoClear=false;
clearColor=overrideMaterial.clearColor||clearColor;
clearAlpha=overrideMaterial.clearAlpha||clearAlpha;
if(clearColor!==undefined&&clearColor!==null){
renderer.setClearColor(clearColor);
renderer.setClearAlpha(clearAlpha||0.0);
renderer.clear();
}
this.scene.overrideMaterial=overrideMaterial;
renderer.render(this.scene,this.camera);
this.scene.overrideMaterial=null;
renderer.autoClear=originalAutoClear;
renderer.setClearColor(this.originalClearColor);
renderer.setClearAlpha(originalClearAlpha);
}
setSize(width,height){
this.width=width;
this.height=height;
this.beautyRenderTarget.setSize(width,height);
this.ssaoRenderTarget.setSize(width,height);
this.normalRenderTarget.setSize(width,height);
this.blurRenderTarget.setSize(width,height);
this.ssaoMaterial.uniforms['resolution'].value.set(width,height);
this.ssaoMaterial.uniforms['cameraProjectionMatrix'].value.copy(this.camera.projectionMatrix);
this.ssaoMaterial.uniforms['cameraInverseProjectionMatrix'].value.copy(this.camera.projectionMatrixInverse);
this.blurMaterial.uniforms['resolution'].value.set(width,height);
}
generateSampleKernel(){
const kernelSize=this.kernelSize;
const kernel=this.kernel;
for(let i=0;i<kernelSize;i++){
const sample=new THREE.Vector3();
sample.x=Math.random()*2-1;
sample.y=Math.random()*2-1;
sample.z=Math.random();
sample.normalize();
let scale=i/kernelSize;
scale=THREE.MathUtils.lerp(0.1,1,scale*scale);
sample.multiplyScalar(scale);
kernel.push(sample);
}
}
generateRandomKernelRotations(){
const width=4,
height=4;
if(THREE.SimplexNoise===undefined){
console.error('THREE.SSAOPass: The pass relies on THREE.SimplexNoise.');
}
const simplex=new THREE.SimplexNoise();
const size=width*height;
const data=new Float32Array(size*4);
for(let i=0;i<size;i++){
const stride=i*4;
const x=Math.random()*2-1;
const y=Math.random()*2-1;
const z=0;
const noise=simplex.noise3d(x,y,z);
data[stride]=noise;
data[stride+1]=noise;
data[stride+2]=noise;
data[stride+3]=1;
}
this.noiseTexture=new THREE.DataTexture(data,width,height,THREE.RGBAFormat,THREE.FloatType);
this.noiseTexture.wrapS=THREE.RepeatWrapping;
this.noiseTexture.wrapT=THREE.RepeatWrapping;
}
overrideVisibility(){
const scene=this.scene;
const cache=this._visibilityCache;
scene.traverse(function(object){
cache.set(object,object.visible);
if(object.isPoints||object.isLine)object.visible=false;
});
}
restoreVisibility(){
const scene=this.scene;
const cache=this._visibilityCache;
scene.traverse(function(object){
const visible=cache.get(object);
object.visible=visible;
});
cache.clear();
}
}
SSAOPass.OUTPUT={
'Default':0,
'SSAO':1,
'Blur':2,
'Beauty':3,
'Depth':4,
'Normal':5
};
THREE.SSAOPass=SSAOPass;
})();
(function(){
class RoomEnvironment extends THREE.Scene{
constructor(){
super();
const geometry=new THREE.BoxGeometry();
geometry.deleteAttribute('uv');
const roomMaterial=new THREE.MeshStandardMaterial({
side:THREE.BackSide
});
const boxMaterial=new THREE.MeshStandardMaterial();
const mainLight=new THREE.PointLight(0xffffff,5.0,28,2);
mainLight.position.set(0.418,16.199,0.300);
this.add(mainLight);
const room=new THREE.Mesh(geometry,roomMaterial);
room.position.set(-0.757,13.219,0.717);
room.scale.set(31.713,28.305,28.591);
this.add(room);
const box1=new THREE.Mesh(geometry,boxMaterial);
box1.position.set(-10.906,2.009,1.846);
box1.rotation.set(0,-0.195,0);
box1.scale.set(2.328,7.905,4.651);
this.add(box1);
const box2=new THREE.Mesh(geometry,boxMaterial);
box2.position.set(-5.607,-0.754,-0.758);
box2.rotation.set(0,0.994,0);
box2.scale.set(1.970,1.534,3.955);
this.add(box2);
const box3=new THREE.Mesh(geometry,boxMaterial);
box3.position.set(6.167,0.857,7.803);
box3.rotation.set(0,0.561,0);
box3.scale.set(3.927,6.285,3.687);
this.add(box3);
const box4=new THREE.Mesh(geometry,boxMaterial);
box4.position.set(-2.017,0.018,6.124);
box4.rotation.set(0,0.333,0);
box4.scale.set(2.002,4.566,2.064);
this.add(box4);
const box5=new THREE.Mesh(geometry,boxMaterial);
box5.position.set(2.291,-0.756,-2.621);
box5.rotation.set(0,-0.286,0);
box5.scale.set(1.546,1.552,1.496);
this.add(box5);
const box6=new THREE.Mesh(geometry,boxMaterial);
box6.position.set(-2.193,-0.369,-5.547);
box6.rotation.set(0,0.516,0);
box6.scale.set(3.875,3.487,2.986);
this.add(box6);
const light1=new THREE.Mesh(geometry,createAreaLightMaterial(50));
light1.position.set(-16.116,14.37,8.208);
light1.scale.set(0.1,2.428,2.739);
this.add(light1);
const light2=new THREE.Mesh(geometry,createAreaLightMaterial(50));
light2.position.set(-16.109,18.021,-8.207);
light2.scale.set(0.1,2.425,2.751);
this.add(light2);
const light3=new THREE.Mesh(geometry,createAreaLightMaterial(17));
light3.position.set(14.904,12.198,-1.832);
light3.scale.set(0.15,4.265,6.331);
this.add(light3);
const light4=new THREE.Mesh(geometry,createAreaLightMaterial(43));
light4.position.set(-0.462,8.89,14.520);
light4.scale.set(4.38,5.441,0.088);
this.add(light4);
const light5=new THREE.Mesh(geometry,createAreaLightMaterial(20));
light5.position.set(3.235,11.486,-12.541);
light5.scale.set(2.5,2.0,0.1);
this.add(light5);
const light6=new THREE.Mesh(geometry,createAreaLightMaterial(100));
light6.position.set(0.0,20.0,0.0);
light6.scale.set(1.0,0.1,1.0);
this.add(light6);
}
}
function createAreaLightMaterial(intensity){
const material=new THREE.MeshBasicMaterial();
material.color.setScalar(intensity);
return material;
}
THREE.RoomEnvironment=RoomEnvironment;
})();
(function(){
class Reflector extends THREE.Mesh{
constructor(geometry,options={}){
super(geometry);
this.type='Reflector';
const scope=this;
const color=options.color!==undefined?new THREE.Color(options.color):new THREE.Color(0x7F7F7F);
const textureWidth=options.textureWidth||512;
const textureHeight=options.textureHeight||512;
const clipBias=options.clipBias||0;
const shader=options.shader||Reflector.ReflectorShader;
const reflectorPlane=new THREE.Plane();
const normal=new THREE.Vector3();
const reflectorWorldPosition=new THREE.Vector3();
const cameraWorldPosition=new THREE.Vector3();
const rotationMatrix=new THREE.Matrix4();
const lookAtPosition=new THREE.Vector3(0,0,-1);
const clipPlane=new THREE.Vector4();
const view=new THREE.Vector3();
const target=new THREE.Vector3();
const q=new THREE.Vector4();
const textureMatrix=new THREE.Matrix4();
const virtualCamera=new THREE.PerspectiveCamera();
const parameters={
minFilter:THREE.LinearFilter,
magFilter:THREE.LinearFilter,
format:THREE.RGBFormat
};
const renderTarget=new THREE.WebGLRenderTarget(textureWidth,textureHeight,parameters);
if(!THREE.MathUtils.isPowerOfTwo(textureWidth)|| !THREE.MathUtils.isPowerOfTwo(textureHeight)){
renderTarget.texture.generateMipmaps=false;
}
const material=new THREE.ShaderMaterial({
uniforms:THREE.UniformsUtils.clone(shader.uniforms),
fragmentShader:shader.fragmentShader,
vertexShader:shader.vertexShader
});
material.uniforms['tDiffuse'].value=renderTarget.texture;
material.uniforms['color'].value=color;
material.uniforms['textureMatrix'].value=textureMatrix;
this.material=material;
this.onBeforeRender=function(renderer,scene,camera){
reflectorWorldPosition.setFromMatrixPosition(scope.matrixWorld);
cameraWorldPosition.setFromMatrixPosition(camera.matrixWorld);
rotationMatrix.extractRotation(scope.matrixWorld);
normal.set(0,0,1);
normal.applyMatrix4(rotationMatrix);
view.subVectors(reflectorWorldPosition,cameraWorldPosition);
if(view.dot(normal)>0)return;
view.reflect(normal).negate();
view.add(reflectorWorldPosition);
rotationMatrix.extractRotation(camera.matrixWorld);
lookAtPosition.set(0,0,-1);
lookAtPosition.applyMatrix4(rotationMatrix);
lookAtPosition.add(cameraWorldPosition);
target.subVectors(reflectorWorldPosition,lookAtPosition);
target.reflect(normal).negate();
target.add(reflectorWorldPosition);
virtualCamera.position.copy(view);
virtualCamera.up.set(0,1,0);
virtualCamera.up.applyMatrix4(rotationMatrix);
virtualCamera.up.reflect(normal);
virtualCamera.lookAt(target);
virtualCamera.far=camera.far;
virtualCamera.updateMatrixWorld();
virtualCamera.projectionMatrix.copy(camera.projectionMatrix);
textureMatrix.set(0.5,0.0,0.0,0.5,0.0,0.5,0.0,0.5,0.0,0.0,0.5,0.5,0.0,0.0,0.0,1.0);
textureMatrix.multiply(virtualCamera.projectionMatrix);
textureMatrix.multiply(virtualCamera.matrixWorldInverse);
textureMatrix.multiply(scope.matrixWorld);
reflectorPlane.setFromNormalAndCoplanarPoint(normal,reflectorWorldPosition);
reflectorPlane.applyMatrix4(virtualCamera.matrixWorldInverse);
clipPlane.set(reflectorPlane.normal.x,reflectorPlane.normal.y,reflectorPlane.normal.z,reflectorPlane.constant);
const projectionMatrix=virtualCamera.projectionMatrix;
q.x=(Math.sign(clipPlane.x)+projectionMatrix.elements[8])/projectionMatrix.elements[0];
q.y=(Math.sign(clipPlane.y)+projectionMatrix.elements[9])/projectionMatrix.elements[5];
q.z= -1.0;
q.w=(1.0+projectionMatrix.elements[10])/projectionMatrix.elements[14];
clipPlane.multiplyScalar(2.0/clipPlane.dot(q));
projectionMatrix.elements[2]=clipPlane.x;
projectionMatrix.elements[6]=clipPlane.y;
projectionMatrix.elements[10]=clipPlane.z+1.0-clipBias;
projectionMatrix.elements[14]=clipPlane.w;
renderTarget.texture.encoding=renderer.outputEncoding;
scope.visible=false;
const currentRenderTarget=renderer.getRenderTarget();
const currentXrEnabled=renderer.xr.enabled;
const currentShadowAutoUpdate=renderer.shadowMap.autoUpdate;
renderer.xr.enabled=false;
renderer.shadowMap.autoUpdate=false;
renderer.setRenderTarget(renderTarget);
renderer.state.buffers.depth.setMask(true);
if(renderer.autoClear===false)renderer.clear();
renderer.render(scene,virtualCamera);
renderer.xr.enabled=currentXrEnabled;
renderer.shadowMap.autoUpdate=currentShadowAutoUpdate;
renderer.setRenderTarget(currentRenderTarget);
const viewport=camera.viewport;
if(viewport!==undefined){
renderer.state.viewport(viewport);
}
scope.visible=true;
};
this.getRenderTarget=function(){
return renderTarget;
};
}
}
Reflector.prototype.isReflector=true;
Reflector.ReflectorShader={
uniforms:{
'color':{
value:null
},
'tDiffuse':{
value:null
},
'textureMatrix':{
value:null
}
},
vertexShader:
`
		uniform mat4 textureMatrix;
		varying vec4 vUv;

		void main() {

			vUv = textureMatrix * vec4( position, 1.0 );

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,
fragmentShader:
`
		uniform vec3 color;
		uniform sampler2D tDiffuse;
		varying vec4 vUv;

		float blendOverlay( float base, float blend ) {

			return( base < 0.5 ? ( 2.0 * base * blend ) : ( 1.0 - 2.0 * ( 1.0 - base ) * ( 1.0 - blend ) ) );

		}

		vec3 blendOverlay( vec3 base, vec3 blend ) {

			return vec3( blendOverlay( base.r, blend.r ), blendOverlay( base.g, blend.g ), blendOverlay( base.b, blend.b ) );

		}

		void main() {

			vec4 base = texture2DProj( tDiffuse, vUv );
			gl_FragColor = vec4( blendOverlay( base.rgb, color ), 1.0 );

		}`
};
THREE.Reflector=Reflector;
})();
(function(){
const _tempNormal=new THREE.Vector3();
function getUv(faceDirVector,normal,uvAxis,projectionAxis,radius,sideLength){
const totArcLength=2*Math.PI*radius/4;
const centerLength=Math.max(sideLength-2*radius,0);
const halfArc=Math.PI/4;
_tempNormal.copy(normal);
_tempNormal[projectionAxis]=0;
_tempNormal.normalize();
const arcUvRatio=0.5*totArcLength/(totArcLength+centerLength);
const arcAngleRatio=1.0-_tempNormal.angleTo(faceDirVector)/halfArc;
if(Math.sign(_tempNormal[uvAxis])===1){
return arcAngleRatio*arcUvRatio;
}else{
const lenUv=centerLength/(totArcLength+centerLength);
return lenUv+arcUvRatio+arcUvRatio*(1.0-arcAngleRatio);
}
}
class RoundedBoxGeometry extends THREE.BoxGeometry{
constructor(width=1,height=1,depth=1,segments=2,radius=0.1){
segments=segments*2+1;
radius=Math.min(width/2,height/2,depth/2,radius);
super(1,1,1,segments,segments,segments);
if(segments===1)return;
const geometry2=this.toNonIndexed();
this.index=null;
this.attributes.position=geometry2.attributes.position;
this.attributes.normal=geometry2.attributes.normal;
this.attributes.uv=geometry2.attributes.uv;
const position=new THREE.Vector3();
const normal=new THREE.Vector3();
const box=new THREE.Vector3(width,height,depth).divideScalar(2).subScalar(radius);
const positions=this.attributes.position.array;
const normals=this.attributes.normal.array;
const uvs=this.attributes.uv.array;
const faceTris=positions.length/6;
const faceDirVector=new THREE.Vector3();
const halfSegmentSize=0.5/segments;
for(let i=0,j=0;i<positions.length;i+=3,j+=2){
position.fromArray(positions,i);
normal.copy(position);
normal.x-=Math.sign(normal.x)*halfSegmentSize;
normal.y-=Math.sign(normal.y)*halfSegmentSize;
normal.z-=Math.sign(normal.z)*halfSegmentSize;
normal.normalize();
positions[i+0]=box.x*Math.sign(position.x)+normal.x*radius;
positions[i+1]=box.y*Math.sign(position.y)+normal.y*radius;
positions[i+2]=box.z*Math.sign(position.z)+normal.z*radius;
normals[i+0]=normal.x;
normals[i+1]=normal.y;
normals[i+2]=normal.z;
const side=Math.floor(i/faceTris);
switch(side){
case 0:
faceDirVector.set(1,0,0);
uvs[j+0]=getUv(faceDirVector,normal,'z','y',radius,depth);
uvs[j+1]=1.0-getUv(faceDirVector,normal,'y','z',radius,height);
break;
case 1:
faceDirVector.set(-1,0,0);
uvs[j+0]=1.0-getUv(faceDirVector,normal,'z','y',radius,depth);
uvs[j+1]=1.0-getUv(faceDirVector,normal,'y','z',radius,height);
break;
case 2:
faceDirVector.set(0,1,0);
uvs[j+0]=1.0-getUv(faceDirVector,normal,'x','z',radius,width);
uvs[j+1]=getUv(faceDirVector,normal,'z','x',radius,depth);
break;
case 3:
faceDirVector.set(0,-1,0);
uvs[j+0]=1.0-getUv(faceDirVector,normal,'x','z',radius,width);
uvs[j+1]=1.0-getUv(faceDirVector,normal,'z','x',radius,depth);
break;
case 4:
faceDirVector.set(0,0,1);
uvs[j+0]=1.0-getUv(faceDirVector,normal,'x','y',radius,width);
uvs[j+1]=1.0-getUv(faceDirVector,normal,'y','x',radius,height);
break;
case 5:
faceDirVector.set(0,0,-1);
uvs[j+0]=getUv(faceDirVector,normal,'x','y',radius,width);
uvs[j+1]=1.0-getUv(faceDirVector,normal,'y','x',radius,height);
break;
}
}
}
}
THREE.RoundedBoxGeometry=RoundedBoxGeometry;
})();
realAddons.ok=!!(THREE.EffectComposer&&THREE.SSAOPass&&THREE.RoomEnvironment&&THREE.Reflector&&THREE.RoundedBoxGeometry&&THREE.FXAAShader);}catch(e){console.warn("REAL addons",e);realAddons.ok=false;}return realAddons.ok;}
function realOpt(k,d,ok){try{const v=localStorage.getItem("w24-real-"+k);return ok.indexOf(v)>=0?v:d;}catch(_){return d;}}
const realLightMode=()=>realOpt("light","day",["day","eve","lamp"]),realWallMode=()=>realOpt("walls","auto",["auto","bazis","off"]);
function realP(){const d={exp:1,env:1,ao:1,refl:1,phN:28,phMax:3200};try{Object.assign(d,JSON.parse(localStorage.getItem("w24-real-p")||"{}"));}catch(_){}return d;}
const REAL_LIGHT={
day:{sun:4.2,sunC:0xfff5ea,dir:[1.0,1.0,0.6],env:1.0,fill:0.3,fillC:0xf2f6ff,lamp:0,led:0.45,win:"day",room:true,exp:1.36,nic:1.2,nicC:0xfff3e4},
eve:{sun:0,sunC:0xffd2a8,dir:[0.4,1.6,0.7],env:1.0,fill:0.08,fillC:0xb4c4e6,lamp:2.6,lampC:0xffe0c2,led:1.6,win:"eve",room:true,exp:1.25,nic:0.8,nicC:0xffdcb8},
lamp:{sun:1.05,sunC:0xffffff,dir:[-0.7,1.2,0.45],env:0.8,fill:0.22,fillC:0xffffff,lamp:0,led:0.7,win:null,room:false,exp:0.95,nic:0.9,nicC:0xffffff}};
const REAL_FILES=[];
function realLib(){return realAddons()?Promise.resolve():Promise.reject(new Error("нет дополнений three"));}
let REAL_SCOPE=0,REAL_INREFL=false;
const REAL_TEX=new Set(),REAL_LIN=new Set(),REAL_MATS=new Set();
function realChunks(){if(realChunks.done)return;realChunks.done=true;const C=THREE.ShaderChunk;
C.tonemapping_pars_fragment=C.tonemapping_pars_fragment.replace("vec3 CustomToneMapping( vec3 color ) { return color; }",
`vec3 CustomToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}`);
C.shadowmap_pars_fragment="#ifndef REAL_SH_OUT\n#define REAL_SH_OUT 1.0\n#endif\n"+C.shadowmap_pars_fragment.replace("float shadow = 1.0;","float shadow = REAL_SH_OUT;");}
function realKelvin(k){const t=k/100;let r,g,b;if(t<=66){r=255;g=99.47*Math.log(t)-161.12;b=t<=19?0:138.52*Math.log(t-10)-305.04;}else{r=329.7*Math.pow(t-60,-0.1332);g=288.12*Math.pow(t-60,-0.0755);b=255;}
const c=v=>Math.max(0,Math.min(255,Math.round(v)));return(c(r)<<16)|(c(g)<<8)|c(b);}
function realLibNote(name){const key=realNorm(name);if(!key||realNotBoard(key))return false;if(realLibF()[key]||realLibL()[key])return false;const a=realSurfAuto(key);if(!a||!a.g)return false;
realLibL()[key]={s:a.s,n:String(name).replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim().slice(0,120),c:1,t:Date.now()};realLS("w24-real-mat",REAL_ML);return true;}
function realPin(){try{if(window.APP_DEMO||window.APP_DES)return"";const p=typeof srvPin==="function"?srvPin():"";if(p)return p;return["cehqr-techpin","cehqr-officepin","cehqr-suppin","cehqr-pin"].map(k=>localStorage.getItem(k)||"").find(Boolean)||"";}catch(_){return"";}}
function realCanEdit(){try{if(typeof clientMode==="function"&&clientMode())return false;if(window.APP_DEMO||window.APP_DES)return false;if(localStorage.getItem("cehqr-techpin"))return true;if(S.shop&&S.shop.tech)return true;if(typeof srvRole==="function"&&srvRole()==="tech")return true;if(typeof siteIsAdmin==="function"&&siteIsAdmin())return true;}catch(_){}return false;}
const realSrvUrl=()=>{try{return(S.site&&S.site.stagesUrl)||"";}catch(_){return"";}};
async function realCfgGet(){const u=realSrvUrl(),pin=realPin();if(!u||!pin)return null;
try{const r=await fetch(u+(u.indexOf("?")>=0?"&":"?")+"action=cfg&pin="+encodeURIComponent(pin)+"&_="+Date.now(),{cache:"no-store"});const j=await r.json();if(!j||!j.ok)return j&&j.error==="pin"?{err:"pin"}:null;return{m:(j.cfg&&j.cfg.realMat&&j.cfg.realMat.m)||{}};}catch(_){return null;}}
function realLibLoad(){if(realLibLoad.p)return realLibLoad.p;
return realLibLoad.p=realCfgGet().then(j=>{if(!j||j.err)return false;const was=JSON.stringify(realLibF());REAL_MF=realLibClean(j.m);realLS("w24-real-matf",REAL_MF);
let ch=false;Object.keys(REAL_MF).forEach(k=>{const L=realLibL()[k];if(L&&L.c){delete REAL_ML[k];ch=true;}});if(ch)realLS("w24-real-mat",REAL_ML);
return was!==JSON.stringify(REAL_MF);});}
async function realLibPush(key,ent){const u=realSrvUrl(),pin=realPin();if(!u||!pin||!realCanEdit())return{local:true};
const cur=await realCfgGet();if(!cur)return{net:true};if(cur.err)return{role:true};
const m=realLibClean(cur.m),L=realLibL();Object.keys(L).forEach(k=>{if(!L[k].c||!m[k])m[k]=L[k];});
const ks=Object.keys(m);if(ks.length>400)ks.sort((a,b)=>(m[a].c-m[b].c)||(m[a].t-m[b].t)).slice(0,ks.length-400).forEach(k=>{delete m[k];});
let j=null;try{const r=await fetch(u,{method:"POST",body:JSON.stringify({action:"cfgSave",key:"realMat",value:{v:1,m},pin,who:(S&&S.who)||"Технолог"})});j=await r.json();}catch(_){return{net:true};}
if(!j)return{net:true};if(!j.ok)return j.error==="role"||j.error==="pin"?{role:true}:{net:true};
REAL_MF=m;realLS("w24-real-matf",REAL_MF);Object.keys(L).forEach(k=>{if(m[k])delete L[k];});realLS("w24-real-mat",L);return{ok:true};}
const realLibPend=()=>{const L=realLibL(),F=realLibF();return Object.keys(L).some(k=>!L[k].c||!F[k]);};
function realLibSync(){if(!realCanEdit()||!realPin()||!realLibPend())return;const now=Date.now();if(realLibSync.t&&now-realLibSync.t<30000)return;realLibSync.t=now;
realLibLoad().then(()=>{if(realLibPend())return realLibPush();}).catch(()=>{});}
function realWoodHex(name,w){if(w!=null)return w;const n=realNorm(name);
let h=null;for(const[re,c]of[[/венге/,0x4a3427],[/орех|walnut|полдао|палдао/,0x8a6446],[/вишн/,0x9c5b3c],[/бук/,0xd2a679],[/ясен/,0xcdb48e],[/сосн|pine/,0xd9b783],[/сонома/,0xc9a77c],[/дуб|oak/,0xb8926a]])if(re.test(n)){h=c;break;}
if(h==null){try{const mc=matColor(name);if(mc!==0xf4f3ef)h=mc;}catch(_){}}if(h==null)h=0xc2a07a;
const k=/светл|light|бел/.test(n)?1.15:/темн|dark/.test(n)?0.7:1;if(k!==1){const f=v=>Math.max(0,Math.min(255,Math.round(k>1?v+(255-v)*(k-1)*1.6:v*k)));h=(f(h>>16&255)<<16)|(f(h>>8&255)<<8)|f(h&255);}
return h;}
const REAL_WTEX={};
function realWoodTex(name,hex){const key=hex+"|"+realNorm(name);if(REAL_WTEX[key])return REAL_WTEX[key];
const N=1024,cv=document.createElement("canvas");cv.width=cv.height=N;const g=cv.getContext("2d"),r=hex>>16&255,gg=hex>>8&255,b=hex&255;
let sd=11;for(const ch of key)sd=(sd*31+ch.charCodeAt(0))%2147483647;sd=sd||7;const rnd=()=>{sd=(sd*16807)%2147483647;return(sd-1)/2147483646;};
g.fillStyle=`rgb(${r},${gg},${b})`;g.fillRect(0,0,N,N);
for(let i=0;i<16;i++){const x=rnd()*N,w=24+rnd()*120,a=0.03+rnd()*0.07,dk=rnd()<0.5;g.fillStyle=dk?`rgba(40,24,10,${a})`:`rgba(255,250,240,${a*0.8})`;for(const o of[-N,0])g.fillRect(x+o,0,w,N);}
for(let i=0;i<10;i++){const x0=rnd()*N,w=6+rnd()*22,a=0.05+rnd()*0.07,f=1+Math.floor(rnd()*2),ph=rnd()*6.283,amp=4+rnd()*14;
g.strokeStyle=`rgba(${r*0.5|0},${gg*0.42|0},${b*0.34|0},${a})`;g.lineWidth=w;for(const o of[-N,0,N]){g.beginPath();for(let y=0;y<=N;y+=16){const x=x0+o+Math.sin(y/N*6.283*f+ph)*amp;if(y)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();}}
for(let i=0;i<300;i++){const x0=rnd()*N,a=0.03+rnd()*0.11,dk=rnd()<0.64,f=1+Math.floor(rnd()*3),ph=rnd()*6.283,amp=1+rnd()*6;
g.strokeStyle=dk?`rgba(${r*0.42|0},${gg*0.36|0},${b*0.3|0},${a})`:`rgba(255,248,232,${a*0.6})`;g.lineWidth=0.5+rnd()*2;
for(const o of[-N,0,N]){g.beginPath();for(let y=0;y<=N;y+=16){const x=x0+o+Math.sin(y/N*6.283*f+ph)*amp;if(y)g.lineTo(x,y);else g.moveTo(x,y);}g.stroke();}}
for(let i=0;i<2600;i++){g.fillStyle=`rgba(30,18,8,${0.05+rnd()*0.09})`;g.fillRect(rnd()*N,rnd()*N,1,2+rnd()*6);}
const t=new THREE.CanvasTexture(cv);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=4;t.userData=t.userData||{};t.userData.realName=String(name||"");t.userData.realGen=1;REAL_WTEX[key]=t;return t;}
function realKind(name,tech,mat){const n=String(name||"").toLowerCase();
if(/^\s*(стена|пол|потолок)|^(stena|beton|oboi|potolok)/.test(n))return{r:0.92,m:0,wall:1,e:1};
if(/зеркал|zerkal|mirror/.test(n))return{r:0.02,m:1,mir:1,c:0xf2f2f2,e:1};
if(/стекл|steklo|glass/.test(n)){if(tech||/черн|чёрн|тонир|графит/.test(n))return{r:0.04,m:0,c:0x050506,cc:1,ccr:0.02,op:0.94,e:1};return{r:0.03,m:0,glass:1,c:0xe9f1f1,e:1};}
if(/(стал|stal|steel|металл).*(черн|чёрн|chern)|(черн|чёрн|chern).*(стал|stal|металл)/.test(n))return{r:0.2,m:0,c:0x0b0b0d,cc:1,ccr:0.03,e:1};
if(/хром|khrom|chrom|никел|nikel/.test(n))return{r:0.05,m:1,c:0xc4c6c6,e:1};
if(/золот|zoloto|латун|latun|brass/.test(n))return{r:0.25,m:1,c:0xf4e4ad,e:1};
if(/антрац|antrats|anthrac|графит|чёрн|черн|chern/.test(n)&&/стал|stal|алюм|alyum|профил|profil|металл|ручк|albion|al_bion|gtv|hettich/.test(n))return{r:0.5,m:0,c:0x2c2d30,e:1};
if(/алюм|alyum|профил|profil|серебр|serebro/.test(n))return{r:0.32,m:1,c:0xe6e8ea,e:1};
if(/стал|stal|steel|инокс|inox|нерж|цинк|tsink|zink|металл/.test(n))return{r:0.3,m:1,c:0xd5d0ca,e:1};
if(/светодиод|svetodiod|диодн|\bled\b|lenta/.test(n)){const K=(n.match(/(\d{4})\s*k/)||[])[1];return{r:0.5,m:0,c:0xfff6e8,emi:realKelvin(+K||4000),e:1};}
if(/пласт|plast/.test(n))return{r:0.45,m:0,e:1};
const sf=realSurf(mat!=null?mat:name)||{s:"matt"},k=Object.assign({},REAL_SURF[sf.s].k);k.surf=sf.s;if(sf.w!=null)k.w=sf.w;
return k;}
const realSpecial=k=>!!(k.m||k.cc||k.c!=null||k.emi||k.mir);
const realIsRoom=p=>/^\s*(стена|пол|потолок)/i.test(String(p&&p.material||""))||/^\s*стена(?![а-яё])/i.test(String(p&&p.name||""));
function realTexPrep(t){if(!t||REAL_TEX.has(t))return;REAL_TEX.add(t);t.encoding=THREE.sRGBEncoding;try{t.anisotropy=Math.max(t.anisotropy||1,(asm&&asm.renderer&&asm.renderer.capabilities.getMaxAnisotropy())||8);}catch(_){}t.needsUpdate=true;}
const REAL_REL=new Map(),REAL_RELQ=[];
function realRelief(map){if(!map)return null;const id=map.uuid;if(REAL_REL.has(id))return REAL_REL.get(id);REAL_REL.set(id,null);REAL_RELQ.push(map);realReliefRun();return null;}
function realReliefRun(){if(realReliefRun.t)return;realReliefRun.t=setTimeout(()=>{realReliefRun.t=0;const i=REAL_RELQ.findIndex(m=>m.image&&(m.image.naturalWidth||m.image.width)>16);
if(i<0){if(REAL_RELQ.length)realReliefRun.t=setTimeout(()=>{realReliefRun.t=0;realReliefRun();},400);return;}
const map=REAL_RELQ.splice(i,1)[0];let R=null;try{R=realReliefMake(map);}catch(e){console.warn("REAL relief",e);}
REAL_REL.set(map.uuid,R||false);if(R)REAL_MATS.forEach(m=>{if(m.map===map&&!m.userData.realNoRel)realReliefSet(m,R);});
try{asm&&asm.loop&&(asm.loop.force&&asm.loop.force(),asm.loop.poke(200));}catch(_){}
if(REAL_RELQ.length)realReliefRun();},120);}
function realReliefMake(map){const im=map.image,w0=im.naturalWidth||im.width,h0=im.naturalHeight||im.height,k=Math.min(1,1024/Math.max(w0,h0)),W=Math.max(8,Math.round(w0*k)),H=Math.max(8,Math.round(h0*k));
const c=document.createElement("canvas");c.width=W;c.height=H;const g=c.getContext("2d");g.drawImage(im,0,0,W,H);const d=g.getImageData(0,0,W,H).data,N=W*H,L=new Float32Array(N);
let s=0,s2=0;for(let i=0;i<N;i++){const v=(0.2126*d[i*4]+0.7152*d[i*4+1]+0.0722*d[i*4+2])/255;L[i]=v;s+=v;s2+=v*v;}
const mean=s/N,sd=Math.sqrt(Math.max(0,s2/N-mean*mean));if(sd<0.025)return null;
const B=new Float32Array(N);for(let y=0;y<H;y++)for(let x=0;x<W;x++){let a=0;for(let j=-1;j<=1;j++){const yy=(y+j+H)%H;for(let i=-1;i<=1;i++)a+=L[yy*W+(x+i+W)%W];}B[y*W+x]=a/9;}
const nc=document.createElement("canvas");nc.width=W;nc.height=H;const ng=nc.getContext("2d"),nd=ng.createImageData(W,H),o=nd.data;
const rc=document.createElement("canvas");rc.width=W;rc.height=H;const rg=rc.getContext("2d"),rd=rg.createImageData(W,H),q=rd.data;
const S=2.2/Math.max(0.05,sd);
for(let y=0;y<H;y++){const ym=((y-1+H)%H)*W,yp=((y+1)%H)*W,yc=y*W;
for(let x=0;x<W;x++){const xm=(x-1+W)%W,xp=(x+1)%W;
const dx=(B[yc+xp]-B[yc+xm])*S,dy=(B[ym+x]-B[yp+x])*S,nz=1/Math.sqrt(dx*dx+dy*dy+1),i=(yc+x)*4;
o[i]=Math.round((-dx*nz*0.5+0.5)*255);o[i+1]=Math.round((-dy*nz*0.5+0.5)*255);o[i+2]=Math.round((nz*0.5+0.5)*255);o[i+3]=255;
const z=Math.max(-1,Math.min(1,(mean-B[yc+x])/(sd*1.6))),r=Math.round((0.8+0.2*z)*255);q[i]=q[i+1]=q[i+2]=r;q[i+3]=255;}}
ng.putImageData(nd,0,0);rg.putImageData(rd,0,0);
const mk=cv=>{const t=new THREE.CanvasTexture(cv);t.wrapS=map.wrapS;t.wrapT=map.wrapT;t.flipY=map.flipY;t.repeat.copy(map.repeat);t.offset.copy(map.offset);try{t.anisotropy=map.anisotropy;}catch(_){}return t;};
const wood=sd>0.06;return{n:mk(nc),r:mk(rc),k:wood?0.32:0.18};}
function realReliefSet(m,R){if(!R||m.normalMap===R.n)return;m.normalMap=R.n;m.normalScale=new THREE.Vector2(R.k,R.k);m.roughnessMap=R.r;m.roughness=Math.min(1,(m.userData.realR||m.roughness)*1.25);m.needsUpdate=true;}
function realOBC(sh){const m=this,v=m.userData.realV||"";
if(v.indexOf("e")>=0&&sh.fragmentShader.indexOf("#include <map_fragment>")>=0){
sh.fragmentShader=sh.fragmentShader.replace("#include <map_fragment>","float rEdge = step( 100.0, vUv.x );\n#include <map_fragment>\ndiffuseColor.rgb *= 1.0 - 0.05 * rEdge;")
.replace("#include <roughnessmap_fragment>","#include <roughnessmap_fragment>\nroughnessFactor = clamp( roughnessFactor - 0.10 * rEdge, 0.04, 1.0 );");}
if(v.indexOf("g")>=0)sh.fragmentShader=sh.fragmentShader.replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
"float rSpec = clamp( dot( reflectedLight.directSpecular + reflectedLight.indirectSpecular, vec3( 0.3333 ) ), 0.0, 1.0 );\ngl_FragColor = vec4( outgoingLight, diffuseColor.a + ( 1.0 - diffuseColor.a ) * rSpec * step( 0.15, diffuseColor.a ) );");
if(v.indexOf("f")>=0&&m.userData.realRefl){const U=m.userData.realRefl;sh.uniforms.tRefl=U.tex;sh.uniforms.reflMat=U.mat;sh.uniforms.rK=U.k;sh.uniforms.rBlur=U.blur;
sh.vertexShader="uniform mat4 reflMat;\nvarying vec4 vRefl;\n"+sh.vertexShader.replace("#include <project_vertex>","#include <project_vertex>\nvRefl = reflMat * vec4( transformed, 1.0 );");
sh.fragmentShader="uniform sampler2D tRefl;\nuniform float rK;\nuniform float rBlur;\nvarying vec4 vRefl;\n"+sh.fragmentShader.replace("gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
`if ( rK > 0.0 ) {
	vec2 ru = vRefl.xy / vRefl.w; float b = rBlur;
	vec3 rc = sRGBToLinear( texture2D( tRefl, ru ) ).rgb * 0.28;
	rc += sRGBToLinear( texture2D( tRefl, ru + vec2( b, 0.0 ) ) ).rgb * 0.12; rc += sRGBToLinear( texture2D( tRefl, ru - vec2( b, 0.0 ) ) ).rgb * 0.12;
	rc += sRGBToLinear( texture2D( tRefl, ru + vec2( 0.0, b * 1.6 ) ) ).rgb * 0.12; rc += sRGBToLinear( texture2D( tRefl, ru - vec2( 0.0, b * 1.6 ) ) ).rgb * 0.12;
	rc += sRGBToLinear( texture2D( tRefl, ru + vec2( b, b ) * 1.8 ) ).rgb * 0.06; rc += sRGBToLinear( texture2D( tRefl, ru - vec2( b, b ) * 1.8 ) ).rgb * 0.06;
	rc += sRGBToLinear( texture2D( tRefl, ru + vec2( b, -b ) * 1.8 ) ).rgb * 0.06; rc += sRGBToLinear( texture2D( tRefl, ru - vec2( b, -b ) * 1.8 ) ).rgb * 0.06;
	float nv = clamp( dot( normal, normalize( vViewPosition ) ), 0.0, 1.0 );
	float fr = 0.04 + 0.96 * pow( 1.0 - nv, 5.0 );
	float k = clamp( rK * fr, 0.0, 0.6 );
	outgoingLight = mix( outgoingLight, rc, k );
}
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`);}
if(v.indexOf("n")>=0){realNUInit();sh.uniforms.realNA=REAL_NU.a;sh.uniforms.realNB=REAL_NU.b;sh.uniforms.realNN=REAL_NU.n;sh.uniforms.realNC=REAL_NU.c;
sh.vertexShader="varying vec3 vRealW;\n"+sh.vertexShader.replace("#include <project_vertex>","#include <project_vertex>\nvRealW = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;");
sh.fragmentShader=REAL_NICHE_GLSL+sh.fragmentShader.replace("#include <lights_fragment_end>","#include <lights_fragment_end>\nreflectedLight.indirectDiffuse += material.diffuseColor * realNC * realNiche( vRealW );");}}
const REAL_NU={a:{value:[]},b:{value:[]},n:{value:0},c:{value:null}};
const REAL_NICHE_GLSL=`uniform vec4 realNA[ 8 ];
uniform vec4 realNB[ 8 ];
uniform float realNN;
uniform vec3 realNC;
varying vec3 vRealW;
float realNiche( vec3 p ) {
	float w = 0.0;
	for ( int i = 0; i < 8; i ++ ) {
		if ( float( i ) >= realNN ) break;
		vec4 a = realNA[ i ]; vec4 b = realNB[ i ];
		if ( p.x > a.x && p.y > a.y && p.z > a.z && p.x < b.x && p.y < b.y && p.z < b.z ) {
			float lo = a.w < 0.5 ? a.x : a.z, hi = a.w < 0.5 ? b.x : b.z, q = a.w < 0.5 ? p.x : p.z;
			float t = b.w > 0.5 ? ( hi - q ) / max( hi - lo, 1e-4 ) : b.w < -0.5 ? ( q - lo ) / max( hi - lo, 1e-4 ) : 0.3;
			w = max( w, mix( 1.0, 0.4, clamp( t, 0.0, 1.0 ) ) );
		}
	}
	return w;
}
`;
function realNUInit(){for(let i=0;i<8;i++){REAL_NU.a.value[i]=REAL_NU.a.value[i]||new THREE.Vector4();REAL_NU.b.value[i]=REAL_NU.b.value[i]||new THREE.Vector4();}REAL_NU.c.value=REAL_NU.c.value||new THREE.Color(0,0,0);}
function realNiches(A){const X=A.real,sc=X.scene0;realNUInit();X.niches=[];REAL_NU.n.value=0;
const byCode=new Map();(X.parts||[]).forEach(p=>{if(p.box)byCode.set(p.code,p);});
const mods=new Map(),cover=[],bb=new THREE.Box3();
sc.children.forEach(m=>{const u=m.userData;if(!m.isMesh||!u||!u.code||u.furn||!u.home||u.realWall||!m.geometry)return;const p=byCode.get(u.code);if(!p)return;
if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const b=m.geometry.boundingBox.clone().translate(u.home),nm=String(p.name||"");
if(/фасад|двер/i.test(nm)||u.facade){if(!u.glass)cover.push(b);return;}
if(u.glass||/цокол|столешн|плинт/i.test(nm)||!u.mod)return;
const M=mods.get(u.mod)||{box:new THREE.Box3(),ms:[],shelf:0,back:null};mods.set(u.mod,M);M.box.union(b);M.ms.push(m);
const s=b.getSize(new THREE.Vector3());if(/полк/i.test(nm)&&s.y<Math.min(s.x,s.z))M.shelf++;
if(/(^|[^а-яё])з\.?\s*с(?![а-яё])|задн/i.test(nm)&&s.y>Math.min(s.x,s.z))M.back=b;});
mods.forEach(M=>{if(!M.shelf||X.niches.length>=8)return;const B=M.box,s=B.getSize(new THREE.Vector3());if(s.x<0.15||s.y<0.15||s.z<0.15)return;
let ax=s.x<s.z?0:2,sg=0;if(M.back){const bs=M.back.getSize(new THREE.Vector3());ax=bs.x<bs.z?0:2;const bc=M.back.getCenter(new THREE.Vector3()),mc=B.getCenter(new THREE.Vector3());sg=(ax?bc.z<mc.z:bc.x<mc.x)?1:-1;}
const A1=ax?"x":"z",fa=s[A1]*s.y,closed=g=>{const F=g>0?(ax?B.max.z:B.max.x):(ax?B.min.z:B.min.x);let cv=0;
cover.forEach(c=>{const lo=ax?c.min.z:c.min.x,hi=ax?c.max.z:c.max.x;if(g>0?!(hi>F-0.012&&lo<F+0.05):!(lo<F+0.012&&hi>F-0.05))return;
const ox=Math.max(0,Math.min(c.max[A1],B.max[A1])-Math.max(c.min[A1],B.min[A1])),oy=Math.max(0,Math.min(c.max.y,B.max.y)-Math.max(c.min.y,B.min.y));cv+=ox*oy;});return cv>fa*0.6;};
if(sg!==0?closed(sg):(closed(1)||closed(-1)))return;
const n={lo:B.min.clone(),hi:B.max.clone(),ax,sg,m:M.ms[0],home:M.ms[0].userData.home.clone()};
const e=0.003;n.lo.x+=e;n.lo.y+=e;n.lo.z+=e;n.hi.x-=e;n.hi.y-=e;n.hi.z-=e;
if(sg>0){if(ax)n.hi.z+=0.006;else n.hi.x+=0.006;}else if(sg<0){if(ax)n.lo.z-=0.006;else n.lo.x-=0.006;}
X.niches.push(n);});
realNicheSync(X);return X.niches.length;}
function realNicheSync(X){const N=X.niches||[],d=new THREE.Vector3();N.forEach((n,i)=>{d.copy(n.m.position).sub(n.home);REAL_NU.a.value[i].set(n.lo.x+d.x,n.lo.y+d.y,n.lo.z+d.z,n.ax?2:0);REAL_NU.b.value[i].set(n.hi.x+d.x,n.hi.y+d.y,n.hi.z+d.z,n.sg);});
REAL_NU.n.value=X.on===false?0:N.length;}
function realOBCKey(){return"real:"+(this.userData.realV||"");}
function realHook(m,v){m.userData.realV=v;m.onBeforeCompile=realOBC;m.customProgramCacheKey=realOBCKey;}
let REAL_Q=null,REAL_QI=0,REAL_FMC={};
function realStd(o,phong){o=Object.assign({},o||{});const sh=o.shininess;["shininess","specular","reflectivity","combine","refractionRatio","specularMap","emissiveMap"].forEach(k=>{delete o[k];});
const bzRoom=!phong&&o.side===THREE.DoubleSide&&o.opacity===0.55&&o.depthWrite===false&&o.color===0xe9e6df;
if(bzRoom){o.opacity=1;o.transparent=false;o.depthWrite=true;}
let k=null,part=false;
const ww=!phong&&o.userData&&o.userData.w24wall;
if(ww){if(ww.glass)k=realKind("стекло");else{k=realKind(ww.material||"стена");if(!k.wall)k=realKind("стена");o.opacity=1;o.transparent=false;o.depthWrite=true;}}
const q=!phong&&!bzRoom&&!ww&&REAL_Q&&REAL_Q[REAL_QI];if(q&&(q.tex?o.map===q.tex:(!o.map&&o.color===q.col))){REAL_QI++;k=q.k;part=true;}
if(bzRoom)k={r:0.92,m:0,wall:1,e:1,c:0xebe7e0};
if(!k&&o.map&&o.map.userData&&o.map.userData.realName)k=realKind(o.map.userData.realName);
if(!k&&phong&&o.color!==undefined){try{k=REAL_FMC[new THREE.Color(o.color).getHexString()]||null;}catch(_){}}
if(!k&&phong)k=sh>=60?{r:0.3,m:1,c:0xd5d0ca,e:1}:{r:0.5,m:0,e:1};
if(!k)k={r:0.65,m:0,e:1};
const m=k.cc?new THREE.MeshPhysicalMaterial(o):new THREE.MeshStandardMaterial(o);
if(k.c!=null&&!m.map){m.color.setHex(k.c);m.color.convertSRGBToLinear();REAL_LIN.add(m.color.getHex());}
else if(o.color!==undefined){const hx=m.color.getHex();if(!REAL_LIN.has(hx)){m.color.convertSRGBToLinear();REAL_LIN.add(m.color.getHex());}}
if(k.wall&&!m.map){const hsl={};m.color.getHSL(hsl);if(hsl.l>0.8)m.color.multiplyScalar(0.8/hsl.l);}
m.roughness=k.r;m.metalness=k.m;m.userData.realR=k.r;m.userData.realE=k.e||1;m.envMapIntensity=m.userData.realE*(REAL_ENV_K||1);m.dithering=true;
if(k.cc){m.clearcoat=k.cc;m.clearcoatRoughness=k.ccr||0.05;}
if(k.emi){m.emissive.setHex(k.emi);m.emissiveIntensity=1.4;m.userData.realEmi=k.emi;}
if(k.op){let v=1;Object.defineProperty(m,"opacity",{configurable:true,get(){return v;},set(x){v=x>=0.2&&x<0.9?k.op:x;}});m.opacity=o.opacity==null?1:o.opacity;}
let V="";if(m.map){realTexPrep(m.map);V+="e";if(!k.wall&&!k.mir&&!k.glass&&!k.m){const R=realRelief(m.map);if(R)realReliefSet(m,R);}else m.userData.realNoRel=1;}
if(k.glass)V+="g";if(!k.wall&&!k.mir&&!k.glass&&!k.emi&&!bzRoom)V+="n";realHook(m,V);
if(k.wall)m.userData.realWall=1;if(k.mir)m.userData.realMir=1;if(bzRoom)m.userData.realBzRoom=1;
m.defines=Object.assign(m.defines||{},{REAL_SH_OUT:REAL_SHOUT});REAL_MATS.add(m);
m.userData.real=1;if(part&&realSpecial(k))m.userData.realSolo=1;return m;}
let REAL_SHOUT="1.0",REAL_ENV_K=1;
function realSolo(A){try{const sc=A.real&&A.real.scene;if(!sc)return;const L=A.real.ledK==null?1:A.real.ledK;sc.children.forEach(m=>{const mt=m.material;if(!mt||!mt.userData||!mt.userData.realSolo||(mt.emissiveIntensity>0.01&&!mt.userData.realEmi))return;
if(mt.userData.realEmi){if(mt.emissiveIntensity>0.01&&mt.emissive.getHex()!==mt.userData.realEmi)return;mt.emissive.setHex(mt.userData.realEmi);mt.emissiveIntensity=0.25+1.6*L;}else{mt.emissive.setHex(0x000001);mt.emissiveIntensity=0.001;}});}catch(_){}}
function realPatch(){if(realPatch.done||typeof THREE==="undefined")return;realPatch.done=true;
const L0=THREE.MeshLambertMaterial,P0=THREE.MeshPhongMaterial;
const L1=function(o){return REAL_SCOPE>0?realStd(o,false):new L0(o);};L1.prototype=L0.prototype;THREE.MeshLambertMaterial=L1;
const P1=function(o){return REAL_SCOPE>0?realStd(o,true):new P0(o);};P1.prototype=P0.prototype;THREE.MeshPhongMaterial=P1;}
{const _tf=texFor;texFor=function(name){let t=_tf.apply(this,arguments);try{if(t&&!t.userData)t.userData={};
if(t&&!t.userData.realName)t.userData.realName=String(name||"");
if(!t&&typeof THREE!=="undefined"&&realOn()&&!/стекл|зеркал/i.test(String(name||""))){const sf=realSurf(name);if(sf&&(sf.s==="wood"||sf.w!=null))t=realWoodTex(name,realWoodHex(name,sf.w));}}catch(_){}return t;};}
function realUndo(){if(!REAL_TEX.size&&!realPatch.done)return;REAL_TEX.forEach(t=>{t.encoding=THREE.LinearEncoding;t.needsUpdate=true;});REAL_TEX.clear();
try{Object.keys(FURN_MAT).forEach(k=>{if(FURN_MAT[k]&&FURN_MAT[k].userData&&FURN_MAT[k].userData.real)delete FURN_MAT[k];});}catch(_){}}
{const _ma=mountAssembly;mountAssembly=function(canvas,parts,opt){
if(typeof THREE==="undefined"||!canvas)return _ma.apply(this,arguments);
if(!realOn()){realUndo();return _ma.apply(this,arguments);}
if(!realAddons()){realUndo();return _ma.apply(this,arguments);}
realPatch();realChunks();REAL_MATS.clear();
const P0=parts||[],bzWalls=P0.some(realIsRoom)||!!(opt&&Array.isArray(opt.walls)&&opt.walls.length)||!!(opt&&opt.furnMesh&&Array.isArray(opt.furnMesh.m)&&opt.furnMesh.m.some(mm=>/^(stena|beton|oboi|potolok)/i.test(mm.n||"")));
const P=realWallMode()==="off"?P0.filter(p=>!realIsRoom(p)):P0;
if(realWallMode()==="off"&&opt&&Array.isArray(opt.walls)&&opt.walls.length)opt=Object.assign({},opt,{walls:[]});
try{const tech=new Set();P.forEach(p=>{const nm=(p.material||"")+" "+(p.name||"");if(p.mod&&(/стал|металл/i.test(p.material||"")&&!/профил/i.test(p.material||"")||/духов|варочн|вытяжк|посудом|микровол|холодил/i.test(nm)))tech.add(String(p.mod));});
REAL_Q=P.filter(p=>p.box).map(p=>{const nm=(p.material||"")+" "+(p.name||""),glass=/стекл/i.test(nm)&&!/зеркал/i.test(nm);
return{k:realIsRoom(p)?realKind("стена"):realKind(nm,!!p.mod&&tech.has(String(p.mod)),glass?nm:p.material),tex:glass?null:texFor(p.material),col:glass?0xbfe3ea:matColor(p.material)};});REAL_QI=0;
let nw=false;new Set(P.filter(p=>p.box&&!realIsRoom(p)).map(p=>p.material||"")).forEach(mt=>{if(realLibNote(mt))nw=true;});if(nw)setTimeout(realLibSync,1500);
REAL_FMC={};const fm=opt&&opt.furnMesh;if(fm&&Array.isArray(fm.m))fm.m.forEach(mm=>{if(mm.c){const h=String(mm.c).replace("#","").toLowerCase();REAL_FMC[h]=REAL_FMC[h]||realKind(mm.n);}});
if(fm&&fm.v===2&&Array.isArray(fm.g))fm.g.forEach(G=>(G.q||[]).forEach(q=>{if(q.c){const h=new THREE.Color(q.c).getHexString();if(!REAL_FMC[h]){const kk=realKind(G.n);if(realSpecial(kk))REAL_FMC[h]=kk;}}}));
}catch(e){console.warn("REAL kinds",e);REAL_Q=null;}
REAL_SCOPE++;let r;try{r=_ma.call(this,canvas,P,opt);}finally{REAL_SCOPE--;REAL_Q=null;}
try{if(asm&&asm.walls){asm.walls.real=true;asm.walls.face();}}catch(_){}
try{if(asm&&asm.renderer&&!asm.real){if(P!==P0)asm.parts=P0;realDress(asm,canvas,P,opt||{},bzWalls);}}catch(e){console.warn("REAL",e);}
try{const A0=asm,mats=[...new Set(P.filter(p=>p.box).map(p=>p.material||""))],sig=()=>mats.map(m=>{const s=realSurf(m);return s?s.s:"";}).join("|"),s0=sig();
realLibLoad().then(ch=>{if(ch&&asm===A0&&A0&&A0.real&&sig()!==s0){disposeAsm();render();}else realLibSync();}).catch(()=>{});}catch(_){}
return r;};}
const REAL_AX=[["z","y"],["z","y"],["x","z"],["x","z"],["x","y"],["x","y"]];
function realRound(A,parts){const byCode=new Map();parts.forEach(p=>{if(p.box)byCode.set(p.code,p);});const K=0.001,sc=A.real.scene0;let n=0;
sc.children.forEach(m=>{const u=m.userData;if(!m.isMesh||!u||!u.code||u.furn||!m.geometry||m.geometry.type!=="BoxGeometry")return;const p=byCode.get(u.code);if(!p)return;
const b=p.box,D={x:b[3]-b[0],y:b[4]-b[1],z:b[5]-b[2]},T=Math.min(D.x,D.y,D.z);if(T<2.5||realIsRoom(p))return;
const rad=(T<=6?0.4:/фасад|дверь|дверц|столешн/i.test((p.name||"")+" "+(p.material||""))?1.5:1)*K;
let g;try{g=new THREE.RoundedBoxGeometry(Math.max(D.x,0.5)*K,Math.max(D.y,0.5)*K,Math.max(D.z,0.5)*K,1,rad);}catch(_){return;}
const pos=g.attributes.position,uv=g.attributes.uv,cnt=pos.count,per=cnt/6,ga=grainAxis(p),tA=D.x===T?"x":D.y===T?"y":"z",tex=!!(m.material&&m.material.map);
const ax={x:0,y:1,z:2};
for(let i=0;i<cnt;i++){const s=Math.floor(i/per),na="xyz"[s>>1],P3=[pos.getX(i),pos.getY(i),pos.getZ(i)],mm=a=>P3[ax[a]]/K+D[a]/2;
if(na===tA||!tex){const[ua,va]=REAL_AX[s],lu=mm(ua)/TEX_TILE,lv=mm(va)/TEX_TILE;if(ga===ua)uv.setXY(i,lv,lu);else uv.setXY(i,lu,lv);}
else{const a="xyz".replace(na,"").replace(tA,"");uv.setXY(i,200+mm(tA)/TEX_TILE,mm(a)/TEX_TILE);}}
uv.needsUpdate=true;const old=m.geometry;m.geometry=g;old.dispose();n++;});
return n;}
function realDress(A,canvas,parts,opt,bzWalls){
const R=A.renderer,X=A.real={on:true,busy:false,scene:null,ph:false,bzWalls,parts,mirrors:[],leds:[]};
try{const pr=Math.min(window.devicePixelRatio||1,3);if(R.getPixelRatio()!==pr){R.setPixelRatio(pr);R.setSize(canvas.clientWidth||1,canvas.clientHeight||1,false);}}catch(_){}
R.shadowMap.enabled=true;R.shadowMap.type=THREE.PCFSoftShadowMap;R.shadowMap.autoUpdate=false;R.shadowMap.needsUpdate=true;
R.outputEncoding=THREE.sRGBEncoding;R.toneMapping=THREE.CustomToneMapping;R.toneMappingExposure=1;R.physicallyCorrectLights=false;
if(A.batch&&A.batch.sync){const s0=A.batch.sync;A.batch.sync=function(){REAL_SCOPE++;try{return s0.apply(this,arguments);}finally{REAL_SCOPE--;}};}
{const st=A.st,ap=st.apply;st.apply=function(){const r=ap.apply(this,arguments);try{realEdges(A);realSolo(A);}catch(_){}return r;};}
const rr=R.render.bind(R);
R.render=function(sc,c){if(X.busy||!sc||!sc.isScene)return rr(sc,c);
if(X.ph&&!X.phDraw)return;
X.cam=c;
if(!X.scene){try{realSetup(A,sc,c);}catch(e){console.warn("REAL setup",e);X.scene=sc;}}
if(sc!==X.scene)return rr(sc,c);
X.busy=true;try{realFrame(A,sc,c,rr);}catch(e){console.warn("REAL frame",e);try{rr(sc,c);}catch(_){}}finally{X.busy=false;}};
if(A.loop&&A.loop.poke)A.loop.poke(300);
}
function realEdges(A){const st=A.st;if(!A.real)return;const sc=A.real.scene;if(!sc)return;
if(!REAL_WIRE)REAL_WIRE=new THREE.Color(0x2a2c2b);
sc.children.forEach(m=>{const u=m.userData;if(!u||!u.code||u.furn||!m.children[0]||!m.children[0].isLineSegments)return;
const sel=st.selected===u.code||(st.multi&&st.multi[u.code]);
if(st.wire||(st.selected&&!sel)){const em=m.children[0].material,hx=em.color.getHex();if(hx===0xffffff||hx===0x8a8a8a)em.color=REAL_WIRE;
const cy=m.children[2];if(cy&&cy.isLineSegments&&cy.material.color.getHex()===0xffffff)cy.material.color.setHex(0xd9480f);return;}
if(sel||st.selected)return;
const e=m.children[0].material;if(e.opacity>0.4)e.opacity=0.4;if(!REAL_EDGE)REAL_EDGE=new THREE.Color(0x3c3e40);e.color=REAL_EDGE;});}
let REAL_EDGE=null,REAL_WIRE=null;
const realLin=h=>new THREE.Color(h).convertSRGBToLinear();
function realSetup(A,sc,c){const X=A.real,R=A.renderer;X.scene=sc;X.scene0=sc;
const roomCodes=new Set((X.parts||[]).filter(realIsRoom).map(p=>p.code));
const lo=new THREE.Vector3(1e9,1e9,1e9),hi=new THREE.Vector3(-1e9,-1e9,-1e9),bb=new THREE.Box3();
sc.children.forEach(m=>{const u=m.userData;if(!m.isMesh||!u||!u.code||u.furn||!u.home)return;if(roomCodes.has(u.code)){u.realWall=1;return;}if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();bb.copy(m.geometry.boundingBox).translate(u.home);lo.min(bb.min);hi.max(bb.max);});
if(lo.x>hi.x){lo.set(-1,-1,-1);hi.set(1,1,1);}
const size=Math.max(hi.x-lo.x,hi.y-lo.y,hi.z-lo.z),ctr=lo.clone().add(hi).multiplyScalar(0.5);X.lo=lo;X.hi=hi;X.size=size;X.ctr=ctr;X.rad=size*1.05+0.4;
let zr=lo.z;sc.children.forEach(m=>{const u=m.userData;if(!m.isMesh||!u||!u.code||u.furn||!u.home||u.realWall)return;bb.copy(m.geometry.boundingBox).translate(u.home);if(bb.max.x>hi.x-0.35)zr=Math.max(zr,bb.max.z);});
X.winZ=Math.min(zr,hi.z)+0.15+0.7;
try{X.nRound=realRound(A,X.parts||[]);}catch(e){console.warn("REAL round",e);}
try{X.nNiche=realNiches(A);}catch(e){console.warn("REAL niche",e);X.niches=[];REAL_NU.n.value=0;}
sc.children.forEach(o=>{if(o.isHemisphereLight||o.isDirectionalLight){o.intensity=0;o.visible=false;}});
const sun=new THREE.DirectionalLight(0xffffff,1);sun.castShadow=true;sc.add(sun);sc.add(sun.target);sun.target.position.copy(ctr);X.sun=sun;
const sh=sun.shadow;sh.mapSize.set(3072,3072);const sr=X.rad*1.6;sh.camera.left=-sr;sh.camera.right=sr;sh.camera.top=sr;sh.camera.bottom=-sr;sh.camera.near=X.rad*0.3;sh.camera.far=X.rad*7;sh.camera.updateProjectionMatrix();sh.bias=-0.0004;sh.normalBias=0.004;
const fill=new THREE.DirectionalLight(0xffffff,0.2);sc.add(fill);sc.add(fill.target);fill.target.position.copy(ctr);X.fill=fill;
const lamp=new THREE.SpotLight(0xffffff,0,0,1.05,0.9,0);lamp.castShadow=true;lamp.shadow.mapSize.set(2048,2048);lamp.shadow.bias=-0.0006;lamp.shadow.normalBias=0.004;
lamp.position.set(ctr.x,lo.y+2.75,hi.z+0.9);lamp.target.position.set(ctr.x,lo.y,lo.z+0.2);sc.add(lamp);sc.add(lamp.target);lamp.visible=false;X.lamp=lamp;
realLeds(A,sc);
realRoom(A);
realMirrors(A,sc);
try{if(A.dimG)A.dimG.traverse(o=>{if(o.isLineSegments&&o.material&&o.material.color)o.material.color.setHex(0x3a3c3e);});}catch(_){}
X.sig="";X.lastC=null;
realApplyLight(A,true);
realPost(A,sc,c);
realSolo(A);
}
function realRoom(A){const X=A.real,sc=X.scene,R=A.renderer,lo=X.lo,hi=X.hi,ctr=X.ctr,size=X.size;
if(X.room){sc.remove(X.room);X.room.traverse(o=>{if(o.geometry&&o.geometry!==X.floorGeo)o.geometry.dispose();if(o.material&&o.material.userData&&!o.material.userData.realKeep){REAL_MATS.delete(o.material);o.material.dispose();}});}
X.walls=[];X.win=null;X.casters=[];
const room=new THREE.Group();room.userData.realRoom=true;sc.add(room);X.room=room;
const WM=realWallMode(),own=WM==="auto"?!X.bzWalls:false,L=REAL_LIGHT[realLightMode()];
X.ownWalls=own;
sc.traverse(o=>{if(o.isMesh&&o.material&&o.material.userData&&o.material.userData.realBzRoom)o.visible=WM!=="off";});
const F=Math.max(size*12,30),wallH=Math.max(6,(hi.y-lo.y)*3),eps=0.0015;
if(!X.floor){const ftx=realParquet();ftx.repeat.set(F/2.4,F/2.4);try{ftx.anisotropy=R.capabilities.getMaxAnisotropy();}catch(_){}
const geo=new THREE.PlaneGeometry(F,F);X.floorGeo=geo;
const fl=new THREE.Reflector(geo,{textureWidth:512,textureHeight:512,clipBias:0.002});
const U={tex:{value:fl.getRenderTarget().texture},mat:{value:fl.material.uniforms.textureMatrix.value},k:{value:1},blur:{value:0.006}};
const fm=new THREE.MeshStandardMaterial({map:ftx,color:0xffffff,roughness:0.45,metalness:0,dithering:true});fm.userData.realRefl=U;fm.userData.realE=1;realHook(fm,"f");fm.defines=Object.assign(fm.defines||{},{REAL_SH_OUT:REAL_SHOUT});REAL_MATS.add(fm);
fl.material.dispose();fl.material=fm;fl.rotation.x=-Math.PI/2;fl.position.set(ctr.x,lo.y-eps,ctr.z);fl.receiveShadow=true;fl.renderOrder=-5;fl.userData.realRoom=true;fl.userData.realRefl=U;fl.userData.on=true;
realReflWrap(fl);fl.raycast=()=>{};X.floor=fl;X.reflFloor=U;}
sc.add(X.floor);
if(own){const wlM=new THREE.MeshStandardMaterial({color:realLin(0xe6e2db),roughness:0.94,metalness:0,dithering:true});wlM.userData.realE=1;wlM.shadowSide=THREE.DoubleSide;
const skM=new THREE.MeshStandardMaterial({color:realLin(0xf3f2ef),roughness:0.6,metalness:0,dithering:true});skM.userData.realE=1;
[wlM,skM].forEach(m=>{m.defines={STANDARD:"",REAL_SH_OUT:REAL_SHOUT};REAL_MATS.add(m);});
const win=L.win?{zc:X.winZ,w:1.4,y0:0.85,y1:2.35}:null;
const wall=(w,rotY,x,z,hole)=>{let geo;if(hole){const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(w/2,wallH);s.lineTo(-w/2,wallH);s.lineTo(-w/2,0);
const hp=new THREE.Path(),u0=hole.zc-z-hole.w/2,u1=hole.zc-z+hole.w/2;hp.moveTo(u0,hole.y0);hp.lineTo(u0,hole.y1);hp.lineTo(u1,hole.y1);hp.lineTo(u1,hole.y0);hp.lineTo(u0,hole.y0);s.holes.push(hp);
geo=new THREE.ShapeGeometry(s);geo.translate(0,-wallH/2,0);}else geo=new THREE.PlaneGeometry(w,wallH);
const m=new THREE.Mesh(geo,wlM);m.rotation.y=rotY;m.position.set(x,lo.y+wallH/2-eps,z);m.receiveShadow=true;m.castShadow=!!win;room.add(m);
const n=new THREE.Vector3(Math.sin(rotY),0,Math.cos(rotY)),sk=new THREE.Mesh(new THREE.BoxGeometry(w,0.07,0.014),skM);sk.rotation.y=rotY;sk.position.set(x+n.x*0.007,lo.y+0.035-eps,z+n.z*0.007);sk.receiveShadow=true;room.add(sk);
X.walls.push({m,sk,n,extra:[]});return X.walls[X.walls.length-1];};
wall(F,0,ctr.x,lo.z-eps);
wall(F,Math.PI/2,lo.x-eps,ctr.z);
const rw=wall(F,-Math.PI/2,hi.x+eps,ctr.z,win);
if(win)realWindow(A,room,rw,win,hi.x+eps,wallH);
if(win){const cm=new THREE.MeshBasicMaterial({colorWrite:false,depthWrite:false,transparent:true,opacity:0});const cw=hi.x-(ctr.x-F/2),ce=new THREE.Mesh(new THREE.PlaneGeometry(cw,F),cm);ce.rotation.x=Math.PI/2;ce.position.set(hi.x-cw/2,lo.y+Math.max(2.75,hi.y-lo.y+0.05),ctr.z);ce.castShadow=true;ce.receiveShadow=false;ce.userData.realShadowOnly=true;room.add(ce);}
}
room.traverse(o=>{o.raycast=()=>{};o.userData.realRoom=true;});
sc.background=realLin(own?0xe6e2db:0xe9e6e0);
X.sig="";R.shadowMap.needsUpdate=true;}
function realWindow(A,room,rw,win,x0,wallH){const X=A.real,lo=X.lo,g=new THREE.Group();g.userData.realWin=true;room.add(g);X.win={g,win,x0};
const wm=new THREE.MeshStandardMaterial({color:realLin(0xf2f2f0),roughness:0.35,metalness:0,dithering:true});wm.userData.realE=1;wm.defines={STANDARD:"",REAL_SH_OUT:REAL_SHOUT};REAL_MATS.add(wm);
const rv=new THREE.MeshStandardMaterial({color:realLin(0xe6e2db),roughness:0.94,metalness:0,dithering:true});rv.userData.realE=1;rv.defines={STANDARD:"",REAL_SH_OUT:REAL_SHOUT};REAL_MATS.add(rv);
const box=(sx,sy,sz,x,y,z,mt,cast)=>{const m=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mt);m.position.set(x,y,z);m.castShadow=cast!==false;m.receiveShadow=true;g.add(m);return m;};
const D=0.2,y0=lo.y+win.y0,y1=lo.y+win.y1,z0=win.zc-win.w/2,z1=win.zc+win.w/2,cy=(y0+y1)/2,h=y1-y0;
box(D,0.01,win.w,x0+D/2,y0-0.005,win.zc,rv);box(D,0.01,win.w,x0+D/2,y1+0.005,win.zc,rv);
box(D,h,0.01,x0+D/2,cy,z0-0.005,rv);box(D,h,0.01,x0+D/2,cy,z1+0.005,rv);
const fx=x0+0.12,P=0.065;
box(0.07,P,win.w,fx,y0+P/2,win.zc,wm);box(0.07,P,win.w,fx,y1-P/2,win.zc,wm);box(0.07,h,P,fx,cy,z0+P/2,wm);box(0.07,h,P,fx,cy,z1-P/2,wm);box(0.07,h,0.08,fx,cy,win.zc,wm);
box(0.27,0.03,win.w+0.1,x0-0.05,y0-0.015,win.zc,wm);
const gm=new THREE.MeshStandardMaterial({color:0xffffff,roughness:0.03,metalness:0,transparent:true,opacity:0.16,depthWrite:false,dithering:true});gm.userData.realE=1.2;realHook(gm,"g");gm.defines={STANDARD:"",REAL_SH_OUT:REAL_SHOUT};REAL_MATS.add(gm);
const gl=new THREE.Mesh(new THREE.PlaneGeometry(win.w,h),gm);gl.rotation.y=-Math.PI/2;gl.position.set(fx,cy,win.zc);gl.renderOrder=3;g.add(gl);
const c=document.createElement("canvas");c.width=4;c.height=128;const cg=c.getContext("2d");X.skyCv=c;
const st=new THREE.CanvasTexture(c);st.encoding=THREE.sRGBEncoding;X.skyTex=st;
const sm=new THREE.MeshBasicMaterial({map:st,toneMapped:false});const sky=new THREE.Mesh(new THREE.PlaneGeometry(8,6),sm);sky.rotation.y=-Math.PI/2;sky.position.set(x0+2.5,y0+1.2,win.zc);g.add(sky);X.sky=sky;
sky.castShadow=false;gl.castShadow=false;
rw.extra.push(g);}
function realSkyPaint(X,mode){if(!X.skyCv)return;const g=X.skyCv.getContext("2d"),gr=g.createLinearGradient(0,0,0,128);
if(mode==="eve"){gr.addColorStop(0,"#0f1a33");gr.addColorStop(0.6,"#2a3c66");gr.addColorStop(1,"#a8768a");}else{gr.addColorStop(0,"#bcd6f2");gr.addColorStop(0.55,"#eef5fc");gr.addColorStop(1,"#ffffff");}
g.fillStyle=gr;g.fillRect(0,0,4,128);X.skyTex.needsUpdate=true;}
function realReflWrap(o){const ob=o.onBeforeRender;o.onBeforeRender=function(r,sc,cam){if(REAL_INREFL||sc.overrideMaterial||!this.userData.on||!cam.isPerspectiveCamera)return;REAL_INREFL=true;try{ob.call(this,r,sc,cam);}finally{REAL_INREFL=false;}};}
function realMirrors(A,sc){const X=A.real;X.mirrors=[];let n=0;
sc.children.forEach(m=>{if(n>=2||!m.isMesh||!m.material||!m.material.userData||!m.material.userData.realMir||!m.userData.code)return;
if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const b=m.geometry.boundingBox,s=b.getSize(new THREE.Vector3()),ax=s.x<=s.y&&s.x<=s.z?"x":s.y<=s.z?"y":"z";
const home=m.userData.home||m.position,toC=home.clone().sub(X.ctr);let sg=Math.sign(toC[ax])||1;if(ax==="y")sg=1;if(ax==="z")sg=1;
const w=ax==="x"?s.z:s.x,h=ax==="y"?s.z:s.y,geo=new THREE.PlaneGeometry(Math.max(0.01,w-0.002),Math.max(0.01,h-0.002));
const rf=new THREE.Reflector(geo,{textureWidth:512,textureHeight:512,clipBias:0.002});
const tm=rf.material.uniforms.textureMatrix.value,tex=rf.getRenderTarget().texture;rf.material.dispose();
rf.material=new THREE.ShaderMaterial({uniforms:{tDiffuse:{value:tex},textureMatrix:{value:tm}},vertexShader:"uniform mat4 textureMatrix; varying vec4 vUv; void main(){ vUv=textureMatrix*vec4(position,1.0); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }",
fragmentShader:"uniform sampler2D tDiffuse; varying vec4 vUv; void main(){ vec4 c=texture2DProj(tDiffuse,vUv); gl_FragColor=vec4(c.rgb*0.93,1.0); }",polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2});
const L=new THREE.Object3D();if(ax==="x")L.rotation.y=sg>0?Math.PI/2:-Math.PI/2;else if(ax==="y")L.rotation.x=-Math.PI/2;else if(sg<0)L.rotation.y=Math.PI;
L.position[ax]=sg*(s[ax]/2+0.0012);L.updateMatrix();
rf.matrixAutoUpdate=false;rf.userData.on=true;rf.userData.realRoom=true;rf.raycast=()=>{};realReflWrap(rf);sc.add(rf);X.mirrors.push({m,rf,L:L.matrix.clone()});n++;});}
function realLeds(A,sc){const X=A.real;X.leds=[];const boxes=[];
sc.traverse(o=>{if(!o.isMesh||!o.material||Array.isArray(o.material)||!o.material.userData||!o.material.userData.realEmi||!o.geometry||!o.geometry.attributes.position)return;
o.updateMatrixWorld(true);const pa=o.geometry.attributes.position,idx=o.geometry.index,V=new THREE.Vector3(),cell=0.12,map=new Map();
const nV=idx?idx.count:pa.count,step=Math.max(1,Math.floor(nV/6000));
for(let j=0;j<nV;j+=step){const i=idx?idx.getX(j):j;V.fromBufferAttribute(pa,i).applyMatrix4(o.matrixWorld);const k=Math.floor(V.x/cell)+","+Math.floor(V.y/cell)+","+Math.floor(V.z/cell);let b=map.get(k);if(!b){b=new THREE.Box3();map.set(k,b);}b.expandByPoint(V);}
const keys=[...map.keys()],seen=new Set();
keys.forEach(k0=>{if(seen.has(k0))return;const st=[k0],B=new THREE.Box3();seen.add(k0);
while(st.length){const k=st.pop();B.union(map.get(k));const[x,y,z]=k.split(",").map(Number);for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){const kk=(x+dx)+","+(y+dy)+","+(z+dz);if(map.has(kk)&&!seen.has(kk)){seen.add(kk);st.push(kk);}}}
boxes.push({B,c:o.material.userData.realEmi});});});
boxes.sort((a,b)=>b.B.getSize(new THREE.Vector3()).length()-a.B.getSize(new THREE.Vector3()).length());
let left=6;boxes.forEach(({B,c})=>{if(left<=0)return;const s=B.getSize(new THREE.Vector3()),up=s.y>Math.max(s.x,s.z),len=up?s.y:Math.max(s.x,s.z),n=Math.max(1,Math.min(left,Math.round(len/0.9)));left-=n;
const m=B.getCenter(new THREE.Vector3());
for(let i=0;i<n;i++){const t=(i+0.5)/n;
if(up){const L=new THREE.PointLight(c,0,1.1,2);L.position.set(m.x,B.min.y+s.y*t,m.z);L.userData.realK=0.6;sc.add(L);X.leds.push(L);continue;}
const p=new THREE.Vector3(s.x>=s.z?B.min.x+s.x*t:m.x,B.min.y-0.01,s.x>=s.z?m.z:B.min.z+s.z*t);
const L=new THREE.SpotLight(c,0,1.8,1.2,1,1.6);L.position.copy(p);L.target.position.set(p.x,p.y-1,p.z+0.15);L.castShadow=false;sc.add(L);sc.add(L.target);X.leds.push(L);}});}
function realApplyLight(A,first){const X=A.real,R=A.renderer,mode=realLightMode(),L=REAL_LIGHT[mode],P=realP();
if(!first&&X.lightMode!==mode&&(X.ownWalls&&(!!REAL_LIGHT[X.lightMode].win)!==(!!L.win))){X.lightMode=mode;realRoom(A);}
X.lightMode=mode;
const dir=new THREE.Vector3(...L.dir).normalize();X.dir=dir;
const sun=X.sun;sun.color.setHex(L.sunC);sun.intensity=L.sun;sun.visible=L.sun>0;sun.position.copy(X.ctr).addScaledVector(dir,X.rad*3);sun.updateMatrixWorld();
X.fill.color.setHex(L.fillC);X.fill.intensity=L.fill;X.fill.position.copy(X.ctr).add(new THREE.Vector3(L.win?1:0.8,0.55,L.win?0.4:0.7).normalize().multiplyScalar(X.rad*3));
X.lamp.visible=L.lamp>0;X.lamp.intensity=L.lamp;if(L.lampC)X.lamp.color.setHex(L.lampC);
X.key=L.sun>0?sun:X.lamp;
X.ledK=L.led;X.leds.forEach(l=>{l.intensity=1.8*L.led*(l.userData.realK||1);});REAL_MATS.forEach(m=>{if(m.userData.realEmi&&!m.userData.realSolo)m.emissiveIntensity=0.25+1.6*L.led;});
realSolo(A);
const shOut=X.ownWalls&&L.win?"0.0":"1.0";if(shOut!==REAL_SHOUT||first){REAL_SHOUT=shOut;REAL_MATS.forEach(m=>{if(m.defines&&m.defines.REAL_SH_OUT!==shOut){m.defines.REAL_SH_OUT=shOut;m.needsUpdate=true;}});}
realSkyPaint(X,mode);
R.toneMappingExposure=L.exp*P.exp;
REAL_ENV_K=L.env*P.env;realEnv(A,mode);
if(REAL_NU.c.value)REAL_NU.c.value.copy(realLin(L.nicC||0xffffff)).multiplyScalar((L.nic||0)*(P.nic==null?1:P.nic));
REAL_MATS.forEach(m=>{m.envMapIntensity=(m.userData.realE||1)*REAL_ENV_K;});
X.sig="";R.shadowMap.needsUpdate=true;if(A.loop){A.loop.force&&A.loop.force();A.loop.poke(300);}}
function realEnv(A,mode){const X=A.real,R=A.renderer;X.envs=X.envs||{};
if(!X.envs[mode]){try{const pm=new THREE.PMREMGenerator(R);const es=mode==="lamp"?new THREE.RoomEnvironment():realEnvScene(X,mode);X.envs[mode]=pm.fromScene(es,0.04).texture;pm.dispose();es.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material)o.material.dispose();});}catch(e){console.warn("REAL env",e);}}
X.scene.environment=X.envs[mode]||null;}
function realEnvScene(X,mode){const s=new THREE.Scene(),bx=new THREE.BoxGeometry(1,1,1),fy=X.lo.y-X.ctr.y;
const add=(hex,k,sx,sy,sz,x,y,z,side)=>{const m=new THREE.Mesh(bx,new THREE.MeshBasicMaterial({color:realLin(hex).multiplyScalar(k),side:side||THREE.FrontSide}));m.scale.set(sx,sy,sz);m.position.set(x,y,z);s.add(m);};
const day=mode!=="eve";
add(0xf2f2f1,day?1.0:0.32,12,6,12,0,fy+3,0,THREE.BackSide);
add(0xb9ad9f,day?0.6:0.2,12,0.02,12,0,fy+0.01,0);
const wz=(X.winZ!=null?X.winZ:X.hi.z+0.85)-X.ctr.z;
add(0x5a524a,day?0.55:0.2,1.0,2.1,0.02,-2.2,fy+1.05,5.95);add(0x3c3f44,day?0.5:0.18,2.6,0.8,0.02,1.2,fy+0.45,5.95);add(0xf4f8ff,day?3:0.25,1.3,1.5,0.02,3.4,fy+1.55,5.95);
if(day){add(0xeaf2ff,7,0.05,1.5,1.4,5.9,fy+1.6,wz);add(0xfff2de,2.2,1.6,0.02,1.0,3.6,fy+0.03,0.3);add(0xffffff,0.9,4,0.02,4,0,fy+5.95,0);}
else{add(0x2a3c66,0.6,0.05,1.5,1.4,5.9,fy+1.6,wz);add(0xffc38c,9,0.5,0.04,0.5,0,fy+5.9,1.2);add(0xffc38c,3,3,0.02,0.4,0,X.hi.y-X.ctr.y-0.75,0.1);}
return s;}
let REAL_PARQ=null;
function realParquet(){if(REAL_PARQ)return REAL_PARQ;const N=1024,c=document.createElement("canvas");c.width=c.height=N;const g=c.getContext("2d");
let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return(sd-1)/2147483646;};
const pw=64,pl=512;
for(let row=0;row<N/pw;row++){const off=Math.floor(rnd()*pl);
for(let x=-off;x<N;x+=pl){const t=rnd(),L=158+Math.round(t*30),cr=L,cg=Math.round(L*0.86),cb=Math.round(L*0.72);
const y=row*pw;g.fillStyle=`rgb(${cr},${cg},${cb})`;g.fillRect(x,y,pl,pw);
for(let k=0;k<30;k++){const yy=y+rnd()*pw,a=0.05+rnd()*0.12,dk=rnd()<0.5;g.strokeStyle=dk?`rgba(120,86,50,${a})`:`rgba(255,240,215,${a})`;g.lineWidth=0.6+rnd()*1.6;
g.beginPath();g.moveTo(x,yy);const ph=rnd()*6,amp=0.6+rnd()*2.2;for(let xx=0;xx<=pl;xx+=32)g.lineTo(x+xx,yy+Math.sin(xx/90+ph)*amp);g.stroke();}
g.fillStyle="rgba(90,62,36,0.55)";g.fillRect(x,y,1.2,pw);}
g.fillStyle="rgba(90,62,36,0.5)";g.fillRect(0,row*pw,N,1.2);}
const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.encoding=THREE.sRGBEncoding;REAL_PARQ=t;return t;}
function realPost(A,sc,c){const X=A.real,R=A.renderer,size=X.size;X.post=true;
try{const comp=new THREE.EffectComposer(R);const sz=R.getSize(new THREE.Vector2());
const ao=new THREE.SSAOPass(sc,c,sz.x,sz.y);realKernel(ao,16);
ao.beautyRenderTarget.texture.encoding=THREE.sRGBEncoding;
try{ao.normalRenderTarget.depthTexture.type=THREE.UnsignedIntType;const bd=new THREE.DepthTexture();bd.type=THREE.UnsignedIntType;ao.beautyRenderTarget.depthTexture=bd;}catch(_){}
ao.kernelRadius=Math.min(0.15,Math.max(0.06,size*0.035));
const ov=ao.overrideVisibility.bind(ao);
ao.overrideVisibility=function(){ov();this.scene.traverse(o=>{if(!o.isMesh||!o.visible)return;const mt=o.material;if(Array.isArray(mt))return;if(!mt||mt.visible===false||mt.opacity<0.6||o.userData.hole||o.userData.glass||o.userData.realShadowOnly||(o.type==="Reflector"&&o!==X.floor)||o===X.sky)o.visible=false;});};
comp.addPass(ao);const fx=new THREE.ShaderPass(THREE.FXAAShader);comp.addPass(fx);
X.comp=comp;X.ao=ao;X.fx=fx;X.compSz="";}catch(e){console.warn("REAL ao",e);X.comp=null;}}
function realKernel(ao,n){if(!ao||ao.kernelSize===n&&ao.kernel.length===n)return;ao.kernelSize=n;ao.kernel=[];ao.generateSampleKernel();ao.ssaoMaterial.uniforms.kernel.value=ao.kernel;ao.ssaoMaterial.defines.KERNEL_SIZE=n;ao.ssaoMaterial.needsUpdate=true;}
function realAoSize(X,W,H){const ao=X.ao,w=Math.max(1,Math.round(W*0.5)),h=Math.max(1,Math.round(H*0.5));
ao.normalRenderTarget.setSize(w,h);ao.ssaoRenderTarget.setSize(w,h);ao.blurRenderTarget.setSize(w,h);ao.ssaoMaterial.uniforms.resolution.value.set(w,h);ao.blurMaterial.uniforms.resolution.value.set(w,h);}
const REAL_DUMMY={position:{x:0,y:0,z:0},quaternion:{x:0,y:0,z:0,w:1},projectionMatrix:{elements:new Array(16).fill(0)},zoom:1};
function realFrame(A,sc,c,rr){const X=A.real,R=A.renderer,st=A.st;
sc.traverse(o=>{if(!o.isMesh)return;const u=o.userData;if(u.realRoom||o.type==="Reflector")return;const mt=o.material;if(!mt||Array.isArray(mt)){o.castShadow=o.receiveShadow=!!mt;return;}
if(mt.isMeshBasicMaterial||u.hole){o.castShadow=false;o.receiveShadow=false;return;}
if(u.realWall||(mt.userData&&mt.userData.realWall)){o.castShadow=false;o.receiveShadow=true;return;}
o.castShadow=mt.opacity>0.6&&!u.glass;o.receiveShadow=true;});
if(X.walls)X.walls.forEach(w=>{const v=c.position.clone().sub(w.m.position).dot(w.n)>0;if(w.sk.visible!==v){w.sk.visible=v;w.extra.forEach(e=>{e.visible=v;});}});
let s="";try{s=perfSig(REAL_DUMMY,sc);}catch(_){s=Math.random()+"";}if(s!==X.sig){X.sig=s;R.shadowMap.needsUpdate=true;}
if(c.isPerspectiveCamera&&c.userData.realNF!==X.size){c.userData.realNF=X.size;c.near=Math.max(0.03,X.size*0.012);c.far=X.size*24+5;c.updateProjectionMatrix();}
if(X.niches&&X.niches.length)realNicheSync(X);
const P=X.P||(X.P=realP()),reflOk=!st.wire&&c.isPerspectiveCamera&&P.refl!==0;
let sz=R.getSize(new THREE.Vector2()),pr=R.getPixelRatio(),key=sz.x+"x"+sz.y+"@"+pr;
if(X.floor){X.floor.userData.on=reflOk;X.reflFloor.k.value=reflOk?0.85:0;X.reflFloor.blur.value=0.0035;
if(X.rsz!==key){X.rsz=key;const w=Math.max(64,Math.round(sz.x*pr*0.5)),h=Math.max(64,Math.round(sz.y*pr*0.5));X.floor.getRenderTarget().setSize(w,h);X.mirrors.forEach(M=>M.rf.getRenderTarget().setSize(w,h));}}
X.mirrors.forEach(M=>{const m=M.m,on=reflOk&&m.visible&&m.material.opacity>0.9&&!(st.selected&&st.selected!==m.userData.code&&!st.steps);M.rf.visible=on;M.rf.userData.on=on;
if(on){m.updateMatrix();M.rf.matrix.multiplyMatrices(m.matrix,M.L);M.rf.matrixWorldNeedsUpdate=true;}});
const cs=c.matrixWorld.elements,ck=cs[0]+cs[5]*3+cs[10]*7+cs[12]*11+cs[13]*13+cs[14]*17+c.projectionMatrix.elements[0]*19,now=performance.now();
if(ck!==X.ck){if(X.ck!==undefined){X.movT=now;clearTimeout(X.movTm);X.movTm=setTimeout(()=>{try{A.loop&&A.loop.force&&A.loop.force();A.loop&&A.loop.poke&&A.loop.poke(60);}catch(_){}},230);}X.ck=ck;}
const moving=X.movT&&now-X.movT<220&&!X.ph;
if(!X.ph){const full=X.fullPR||(X.fullPR=R.getPixelRatio());if(X.movPR==null)X.movPR=full;
if(moving){const dt=X.lastF?now-X.lastF:0;X.lastF=now;if(dt>0&&dt<5000){(X.ft=X.ft||[]).push(dt);if(X.ft.length>=8){const m=X.ft.slice().sort((a,b)=>a-b)[4];X.ft=[];if(m>24&&X.movPR>1.25)X.movPR=Math.max(1.25,X.movPR-0.5);}}}
else X.lastF=0;
const want=moving?Math.min(full,X.movPR):full;if(R.getPixelRatio()!==want){R.setPixelRatio(want);R.setSize(R.domElement.clientWidth||1,R.domElement.clientHeight||1,false);}}
const useAO=X.comp&&!st.wire&&!c.isOrthographicCamera&&!X.noAO&&P.ao!==0&&!moving;
pr=R.getPixelRatio();key=sz.x+"x"+sz.y+"@"+pr;
if(X.floor&&X.rsz!==key){X.rsz=key;const w=Math.max(64,Math.round(sz.x*pr*0.5)),h=Math.max(64,Math.round(sz.y*pr*0.5));X.floor.getRenderTarget().setSize(w,h);X.mirrors.forEach(M=>M.rf.getRenderTarget().setSize(w,h));}
if(!useAO){rr(sc,c);return;}
if(key!==X.compSz){X.compSz=key;X.comp.setPixelRatio(pr);X.comp.setSize(sz.x,sz.y);realAoSize(X,sz.x*pr,sz.y*pr);X.fx.uniforms.resolution.value.set(1/(sz.x*pr),1/(sz.y*pr));}
const ao=X.ao,u=ao.ssaoMaterial.uniforms;ao.camera=c;
if(X.lastC!==c||u.cameraNear.value!==c.near||u.cameraFar.value!==c.far){X.lastC=c;u.cameraNear.value=c.near;u.cameraFar.value=c.far;ao.depthRenderMaterial.uniforms.cameraNear.value=c.near;ao.depthRenderMaterial.uniforms.cameraFar.value=c.far;}
u.cameraProjectionMatrix.value.copy(c.projectionMatrix);u.cameraInverseProjectionMatrix.value.copy(c.projectionMatrixInverse);
const span=Math.max(1e-6,c.far-c.near);ao.minDistance=(X.aoMin||0.02)/span;ao.maxDistance=(X.aoMax||0.5)/span;
X.comp.render();
try{if(sc.overrideMaterial)sc.overrideMaterial=null;}catch(_){}
}
function realPhoto(){const A=asm;if(!A||!A.real||!A.real.scene||A.real.ph)return;const X=A.real,R=A.renderer,cv=R.domElement,st=A.st;
const cam=X.cam;
if(!cam){toast("Фото не получилось");return;}X.ph=true;
const ov=document.createElement("div");ov.className="real-ph";ov.innerHTML=`<div class="real-ph-in"><div class="real-ph-wait"><b>Готовлю фото…</b><i><s style="transform:scaleX(0)"></s></i><small>0 %</small></div></div>`;document.body.appendChild(ov);
requestAnimationFrame(()=>ov.classList.add("on"));
const bar=ov.querySelector("s"),pct=ov.querySelector("small");
const pr0=R.getPixelRatio(),sz0=R.getSize(new THREE.Vector2()),cw=sz0.x,ch=sz0.y;
const PP=realP(),k=Math.min(2*Math.min(pr0,2),(PP.phMax||3200)/Math.max(cw,ch)),W=Math.round(cw*k),H=Math.round(ch*k);
const key=X.key||X.sun,sp0=key.position.clone(),ms0=key.shadow.mapSize.clone(),ks0=X.ao&&X.ao.kernelSize,N=PP.phN||28;
const acc=document.createElement("canvas");acc.width=W;acc.height=H;const g=acc.getContext("2d");
const restore=()=>{cam.clearViewOffset&&cam.clearViewOffset();key.position.copy(sp0);key.updateMatrixWorld();if(key.shadow.map){key.shadow.map.dispose();key.shadow.map=null;}key.shadow.mapSize.copy(ms0);
R.setPixelRatio(pr0);R.setSize(cw,ch,false);X.compSz="";X.rsz="";if(X.ao&&ks0)realKernel(X.ao,ks0);
R.shadowMap.needsUpdate=true;X.ph=false;if(A.loop){A.loop.force&&A.loop.force();A.loop.poke(300);}};
try{if(key.shadow.map){key.shadow.map.dispose();key.shadow.map=null;}key.shadow.mapSize.set(4096,4096);
R.setPixelRatio(1);R.setSize(W,H,false);X.compSz="";X.rsz="";
if(X.ao)realKernel(X.ao,32);
}catch(e){console.warn("REAL photo",e);restore();ov.remove();toast("Фото не получилось");return;}
const hold=[];try{if(A.dimG){hold.push([A.dimG,A.dimG.visible]);A.dimG.visible=false;}}catch(_){}
const hal=(i,b)=>{let f=1,r=0;while(i>0){f/=b;r+=f*(i%b);i=Math.floor(i/b);}return r;};
const kd=key===X.sun?X.dir:new THREE.Vector3(0,1,0),right=new THREE.Vector3().crossVectors(kd,Math.abs(kd.y)>0.99?new THREE.Vector3(1,0,0):new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,kd).normalize();
const jr=key===X.sun?X.rad*0.035:0.08;
let i=0,dead=false;ov.addEventListener("click",e=>{if(e.target.closest("[data-real-x]")){dead=true;}});
const step=()=>{if(dead){restore();hold.forEach(h=>h[0].visible=h[1]);ov.remove();return;}
const t0=performance.now();
while(i<N&&performance.now()-t0<60){
const jx=hal(i+1,2)-0.5,jy=hal(i+1,3)-0.5;cam.setViewOffset&&cam.setViewOffset(W,H,jx,jy,W,H);
const a=hal(i+1,5)*Math.PI*2,rr2=Math.sqrt(hal(i+1,7))*jr;key.position.copy(sp0).addScaledVector(right,Math.cos(a)*rr2).addScaledVector(up,Math.sin(a)*rr2);key.updateMatrixWorld();
R.shadowMap.needsUpdate=true;X.phDraw=true;try{R.render(X.scene,cam);}finally{X.phDraw=false;}
g.globalAlpha=1/(i+1);g.drawImage(cv,0,0,W,H);i++;}
bar.style.transform=`scaleX(${i/N})`;pct.textContent=Math.round(i/N*100)+" %";
if(i<N){setTimeout(step,0);return;}
restore();hold.forEach(h=>h[0].visible=h[1]);
acc.toBlob(b=>{if(!b){ov.remove();toast("Фото не получилось");return;}const url=URL.createObjectURL(b),o=(S.orders&&S.current&&S.orders[S.current.orderId])||{},fname=`${String(o.name||"заказ").replace(/[\\/:*?"<>|]+/g," ").trim()}-${(S.current&&S.current.orderId)||""}-фото.png`;
ov.querySelector(".real-ph-in").innerHTML=`<img alt="Фото изделия" src="${url}"><div class="real-ph-bar"><span>${W} × ${H}</span><a class="real-ph-btn" download="${esc(fname)}" href="${url}">Сохранить</a>${navigator.canShare?`<button type="button" class="real-ph-btn" data-real-share>Отправить</button>`:""}<button type="button" class="real-ph-btn x" data-real-x aria-label="Закрыть">Закрыть</button></div>`;
ov.onclick=e=>{if(e.target.closest("[data-real-x]")){ov.classList.remove("on");setTimeout(()=>{ov.remove();URL.revokeObjectURL(url);},200);}
else if(e.target.closest("[data-real-share]")){try{const f=new File([b],fname,{type:"image/png"});if(navigator.canShare({files:[f]}))navigator.share({files:[f],title:"Фото изделия"}).catch(()=>{});}catch(_){}}};},"image/png");};
setTimeout(step,30);
}
{const _qb=dqBar;dqBar=function(){const h=_qb.apply(this,arguments);if(!realOn())return h;
return h.replace(/(<div class="dq-l">[\s\S]*?)(<\/div>)/,`$1<button type="button" class="dq-b real-ph-b" data-act="real-photo" title="Фото как настоящее — большая картинка с тенями" aria-label="Фото"><svg viewBox="0 0 24 24"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg><span>Фото</span></button>$2`);};}
function realMenuHtml(){const on=realOn(),lm=realLightMode(),wm=realWallMode();
const ch=(act,v,txt,p)=>`<button type="button" class="dq-ch${p?" on":""}" data-act="${act}"${v?` data-v="${v}"`:""} aria-pressed="${!!p}">${txt}</button>`;
let h=`<p class="dq-h">Реализм</p><div class="dq-chips real-chips">`+ch("real-toggle","","Реализм",on)+(on?`<button type="button" class="dq-ch real-ph-ch" data-act="real-photo">Фото</button>`:"")+`</div>`;
if(on)h+=`<p class="dq-h">Свет</p><div class="dq-chips real-chips">`+ch("real-light","day","День",lm==="day")+ch("real-light","eve","Вечер",lm==="eve")+ch("real-light","lamp","Лампа",lm==="lamp")+`</div>`
+`<p class="dq-h">Стены</p><div class="dq-chips real-chips">`+ch("real-walls","auto","Авто",wm==="auto")+ch("real-walls","bazis","Из Базиса",wm==="bazis")+ch("real-walls","off","Выкл",wm==="off")+`</div>`;
if(on&&!(typeof clientMode==="function"&&clientMode())){const nc=realMatRows().filter(r=>r.g).length;
h+=`<p class="dq-h">Материалы</p><div class="dq-chips real-chips"><button type="button" class="dq-ch real-mat-b" data-act="real-mat">Глянец и мат${nc?` <b class="real-chk">${nc} проверить</b>`:""}</button></div>`;}
return h;}
{const _dm=dqMenu;dqMenu=function(){const h=_dm.apply(this,arguments);try{const i=h.indexOf("</div>",h.indexOf('<div class="dq-chips">'));if(i<0)return h;return h.slice(0,i+6)+realMenuHtml()+h.slice(i+6);}catch(_){return h;}};}
function realMenuSync(){const m=document.querySelector(".dq-menu");if(!m)return;
const lm=realLightMode(),wm=realWallMode();m.querySelectorAll('[data-act="real-light"]').forEach(b=>{const p=b.dataset.v===lm;b.classList.toggle("on",p);b.setAttribute("aria-pressed",String(p));});
m.querySelectorAll('[data-act="real-walls"]').forEach(b=>{const p=b.dataset.v===wm;b.classList.toggle("on",p);b.setAttribute("aria-pressed",String(p));});}
document.addEventListener("click",e=>{const t=e.target.closest&&e.target.closest('[data-act="real-photo"],[data-act="real-toggle"],[data-act="real-light"],[data-act="real-walls"],[data-act="real-mat"]');if(!t)return;e.preventDefault();e.stopImmediatePropagation();
const act=t.dataset.act;
if(act==="real-mat"){try{const m=document.querySelector(".dq-menu");if(m)m.hidden=true;}catch(_){}realMatOpen();return;}
if(act==="real-photo"){if(!asm||!asm.real){toast("Фото — в режиме «Реализм»");return;}realPhoto();return;}
if(act==="real-light"){try{localStorage.setItem("w24-real-light",t.dataset.v);}catch(_){}realMenuSync();try{if(asm&&asm.real&&asm.real.scene)realApplyLight(asm);}catch(err){console.warn("REAL light",err);}return;}
if(act==="real-walls"){const was=realWallMode();try{localStorage.setItem("w24-real-walls",t.dataset.v);}catch(_){}realMenuSync();
try{const A=asm;if(!A||!A.real||!A.real.scene)return;const needRebuild=A.real.bzWalls&&((was==="off")!==(t.dataset.v==="off"));
if(needRebuild){disposeAsm();render();}else{realRoom(A);realApplyLight(A);}}catch(err){console.warn("REAL walls",err);}return;}
try{if(realOn())localStorage.removeItem("w24-real");else localStorage.setItem("w24-real","1");const u=new URL(location.href);if(u.searchParams.has("real")){u.searchParams.delete("real");history.replaceState(history.state,"",u.toString());}}catch(_){}
try{disposeAsm();}catch(_){}render();
toast(realOn()?"Реализм включён: окно, тени, отражения, «Фото»":"Реализм выключен — обычный вид");},true);
const realEsc=v=>String(v==null?"":v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function realMatRows(){let parts=[];try{parts=(asm&&asm.real&&asm.real.parts)||(S.current&&S.current.parts)||[];}catch(_){}
const seen=new Set(),out=[];parts.forEach(p=>{if(!p||!p.box||realIsRoom(p))return;const nm=String(p.material||""),k=realNorm(nm);if(!k||seen.has(k))return;seen.add(k);const sf=realSurf(nm);if(!sf)return;
out.push({k,n:nm.replace(/[\r\n\t]+/g," ").replace(/\s+/g," ").trim(),s:sf.s,src:sf.src,g:sf.g,lib:sf.lib,cnt:parts.filter(q=>q&&realNorm(q.material)===k).length});});
return out.sort((a,b)=>(b.g-a.g)||(b.cnt-a.cnt));}
function realMatOther(cur){const F=realLibF(),L=realLibL(),have=new Set(cur.map(r=>r.k)),out=[];new Set(Object.keys(F).concat(Object.keys(L))).forEach(k=>{if(have.has(k))return;const e=L[k]&&!L[k].c?L[k]:(F[k]||L[k]);if(e&&e.c)out.push({k,n:e.n||k,s:e.s,src:"угадано",g:true});});return out.slice(0,60);}
function realMatRow(r,can){const o=REAL_SURF_ORD.map(s=>`<option value="${s}"${s===r.s?" selected":""}>${REAL_SURF[s].t}</option>`).join("");
return`<div class="real-ml-r" data-k="${realEsc(r.k)}" data-n="${realEsc(r.n)}"><div class="real-ml-t"><span class="real-ml-n">${realEsc(r.n)}</span><small>${r.g?`<b class="real-chk">проверить</b> `:""}${realEsc(r.src||"")}${r.cnt?` · ${r.cnt} дет.`:""}</small></div>`
+`<div class="real-ml-c">${can?(r.g?`<button type="button" class="real-ml-ok" data-act="real-mat-ok" aria-label="Поверхность верна">Верно</button>`:"")+`<select class="real-ml-s" data-act="real-mat-s" aria-label="Поверхность">${o}</select>`:`<span class="real-ml-v">${REAL_SURF[r.s].t}</span>`}</div></div>`;}
function realMatHtml(){const can=realCanEdit(),rows=realMatRows(),oth=realMatOther(rows);
return`<div class="real-ml-in" role="document"><div class="real-ml-hd"><b>Глянец и мат</b><button type="button" class="real-ml-x" data-act="real-mat-x" aria-label="Закрыть"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
<p class="real-ml-sub">Как блестит каждый материал в «Реализме». Узнаём по артикулу и названию; новый материал встаёт сам с пометкой «проверить».</p>
<p class="real-ml-st" aria-live="polite"></p>
<p class="real-ml-h">В этом заказе</p>${rows.length?rows.map(r=>realMatRow(r,can)).join(""):`<p class="real-ml-sub">Плит в заказе нет</p>`}
${oth.length?`<p class="real-ml-h">Проверить — из других заказов</p>`+oth.map(r=>realMatRow(r,can)).join(""):""}
${can?"":`<p class="real-ml-sub">Поправить может директор или технолог.</p>`}</div>`;}
function realMatOpen(){document.querySelectorAll(".real-ml").forEach(x=>x.remove());const d=document.createElement("div");d.className="real-ml";d.setAttribute("role","dialog");d.setAttribute("aria-modal","true");d.setAttribute("aria-label","Глянец и мат");
d.innerHTML=realMatHtml();document.body.appendChild(d);requestAnimationFrame(()=>requestAnimationFrame(()=>d.classList.add("on")));
d.addEventListener("click",e=>{if(e.target===d||e.target.closest('[data-act="real-mat-x"]')){realMatClose(d);return;}const ok=e.target.closest('[data-act="real-mat-ok"]');if(ok){const r=ok.closest(".real-ml-r");realMatSet(d,r,r.querySelector("select").value);}});
d.addEventListener("change",e=>{const sel=e.target.closest('[data-act="real-mat-s"]');if(sel)realMatSet(d,sel.closest(".real-ml-r"),sel.value);});
d.tabIndex=-1;d.addEventListener("keydown",e=>{if(e.key==="Escape")realMatClose(d);});try{d.focus({preventScroll:true});}catch(_){}}
function realMatClose(d){d.classList.remove("on");setTimeout(()=>d.remove(),230);
if(d.dataset.dirty&&asm&&asm.real){setTimeout(()=>{try{disposeAsm();render();}catch(err){console.warn("REAL mat",err);}},240);}}
async function realMatSet(d,row,s){if(!row||!REAL_SURF[s])return;const k=row.dataset.k,n=row.dataset.n,L=realLibL(),prev=L[k]?Object.assign({},L[k]):null;
L[k]={s,n,c:0,t:Date.now()};realLS("w24-real-mat",L);d.dataset.dirty="1";
const fresh=()=>{const r=realMatRows().concat(realMatOther(realMatRows())).find(x=>x.k===k);if(r){const t=document.createElement("div");t.innerHTML=realMatRow(r,true);row.replaceWith(t.firstChild);}};
fresh();const st=d.querySelector(".real-ml-st"),say=(t,c)=>{if(st){st.textContent=t;st.className="real-ml-st"+(c?" "+c:"");}};
say("Сохраняю…");const res=await realLibPush(k,{s,n,c:0,t:Date.now()});
if(res.ok)say("Сохранено для всей фирмы","ok");
else if(res.role){if(prev)L[k]=prev;else delete L[k];realLS("w24-real-mat",L);const r2=d.querySelector(`.real-ml-r[data-k="${CSS.escape(k)}"]`);if(r2){const r=realMatRows().concat(realMatOther(realMatRows())).find(x=>x.k===k);if(r){const t=document.createElement("div");t.innerHTML=realMatRow(r,true);r2.replaceWith(t.firstChild);}}say("Не сохранилось: поправить может директор или технолог","bad");}
else if(res.local)say("Сохранено на этом устройстве");
else say("Нет связи с таблицей — поправка сохранена на этом устройстве и уйдёт в фирму позже","warn");}
{const st=document.createElement("style");st.id="realCss";
st.textContent=`html .dq-b.real-ph-b,html.vt.sk.sk.sk.sk.sk.sk .dq-b.real-ph-b{width:auto!important;min-width:0!important;padding:0 16px 0 13px!important;gap:7px;display:inline-flex!important;align-items:center;justify-content:center;font:600 15px/1 -apple-system,system-ui,"Segoe UI",Arial,sans-serif;min-height:44px;border-radius:999px!important}
.dq-b.real-ph-b span{white-space:nowrap}   /* телефон: «Фото» — в меню «⋮» (15.11: в верхней строке кнопка «⋮» из-за неё уходила за край экрана) */
.dq-b.real-ph-b svg{width:20px!important;height:20px!important;flex:none}
@media (max-width:699px){html .dq-b.real-ph-b,html.vt.sk.sk.sk.sk.sk.sk .dq-b.real-ph-b{display:none!important}}
@media (min-width:700px){.dq-ch.real-ph-ch{display:none}}
.real-ph{position:fixed;inset:0;z-index:2147480000;background:rgba(0,0,0,.86);display:flex;align-items:center;justify-content:center;opacity:0;transition:opacity .2s;-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.real-ph.on{opacity:1}
.real-ph-in{display:flex;flex-direction:column;align-items:center;gap:12px;max-width:100vw;max-height:100vh;padding:calc(12px + env(safe-area-inset-top,0px)) 12px calc(12px + env(safe-area-inset-bottom,0px));box-sizing:border-box}
.real-ph-in img{max-width:calc(100vw - 24px);max-height:calc(100vh - 110px);border-radius:14px;border:1px solid rgba(255,255,255,.14);object-fit:contain}
.real-ph-wait{display:flex;flex-direction:column;align-items:center;gap:10px;color:#fff;font:600 17px/1.2 -apple-system,system-ui,"Segoe UI",Arial,sans-serif}
.real-ph-wait i{display:block;width:220px;height:6px;border-radius:3px;background:rgba(255,255,255,.16);overflow:hidden}
.real-ph-wait s{display:block;height:100%;background:#30d158;transform-origin:0 50%;transition:transform .2s}
.real-ph-wait small{font-weight:500;color:rgba(255,255,255,.7);font-size:14px}
.real-ph-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center;color:rgba(255,255,255,.7);font:500 14px/1 -apple-system,system-ui,"Segoe UI",Arial,sans-serif}
.real-ph-btn{min-height:44px;padding:0 18px;border-radius:22px;border:1px solid rgba(255,255,255,.18);background:#30d158;color:#000;font:600 16px/44px -apple-system,system-ui,"Segoe UI",Arial,sans-serif;text-decoration:none;cursor:pointer}
.real-ph-btn.x{background:rgba(255,255,255,.12);color:#fff}
.real-chk{display:inline-block;padding:2px 7px;border-radius:9px;background:rgba(255,214,10,.18);color:#ffd60a;font:600 12px/1.3 -apple-system,system-ui,"Segoe UI",Arial,sans-serif;vertical-align:1px}
.dq-ch.real-mat-b{display:inline-flex;align-items:center;gap:6px;min-height:44px}
.real-ml{position:fixed;inset:0;z-index:2147480000;background:rgba(0,0,0,.5);display:flex;align-items:flex-end;justify-content:center;opacity:0;transition:opacity .2s ease}
.real-ml.on{opacity:1}
.real-ml-in{width:100%;max-height:84vh;overflow:auto;-webkit-overflow-scrolling:touch;overscroll-behavior:contain;background:#1c1c1e;color:#fff;border:1px solid rgba(255,255,255,.12);border-bottom:0;border-radius:18px 18px 0 0;padding:6px 16px calc(16px + env(safe-area-inset-bottom,0px));box-sizing:border-box;transform:translateY(24px);transition:transform .22s ease;font:400 15px/1.35 -apple-system,system-ui,"Segoe UI",Arial,sans-serif}
.real-ml.on .real-ml-in{transform:none}
@media (min-width:700px){.real-ml{align-items:center}.real-ml-in{width:540px;max-height:80vh;border-radius:18px;border-bottom:1px solid rgba(255,255,255,.12);transform:scale(.97)}}
.real-ml-hd{display:flex;align-items:center;justify-content:space-between;position:sticky;top:-6px;background:#1c1c1e;padding:8px 0 4px;z-index:1}
.real-ml-hd b{font:700 19px/1.2 -apple-system,system-ui,"Segoe UI",Arial,sans-serif}
.real-ml-x{width:44px;height:44px;border-radius:22px;border:0;background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;cursor:pointer;flex:none}
.real-ml-x svg{width:18px;height:18px;stroke:#fff;stroke-width:2.2;fill:none;stroke-linecap:round}
.real-ml-sub{margin:2px 0 8px;color:rgba(235,235,245,.6);font-size:14px}
.real-ml-st{margin:0;min-height:0;font-size:14px;color:rgba(235,235,245,.6)}
.real-ml-st:empty{display:none}
.real-ml-st.ok{color:#30d158}.real-ml-st.warn{color:#ffd60a}.real-ml-st.bad{color:#ff453a}
.real-ml-h{margin:14px 0 4px;font:600 13px/1.2 -apple-system,system-ui,"Segoe UI",Arial,sans-serif;color:rgba(235,235,245,.6);text-transform:none}
.real-ml-r{display:flex;align-items:center;gap:10px;padding:10px 0;border-top:1px solid rgba(255,255,255,.08)}
.real-ml-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px}
.real-ml-n{font-weight:600;word-break:break-word}
.real-ml-t small{color:rgba(235,235,245,.6);font-size:13px}
.real-ml-c{display:flex;align-items:center;gap:8px;flex:none}
.real-ml{outline:none}
.real-ml .real-ml-s.real-ml-s{-webkit-appearance:none;appearance:none;min-height:44px;padding:0 32px 0 14px;border-radius:22px;border:1px solid rgba(255,255,255,.14);background:#2c2c2e url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' fill='none' stroke='%23fff' stroke-width='1.6'/%3E%3C/svg%3E") no-repeat right 12px center/11px 8px!important;color:#fff;font:600 15px -apple-system,system-ui,"Segoe UI",Arial,sans-serif;cursor:pointer;max-width:150px;width:auto;height:auto;margin:0;box-shadow:none}
.real-ml-ok{min-height:44px;padding:0 14px;border-radius:22px;border:1px solid rgba(48,209,88,.45);background:rgba(48,209,88,.14);color:#30d158;font:600 15px -apple-system,system-ui,"Segoe UI",Arial,sans-serif;cursor:pointer}
.real-ml-v{font-weight:600;color:#fff}
@media (max-width:380px){.real-ml-r{flex-wrap:wrap}.real-ml-c{width:100%;justify-content:flex-end}}`;
document.head.appendChild(st);}