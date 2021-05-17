#version 300 es

precision highp float;

out vec4 outColor;

struct Kernel {
    float data[512];
    int size; // MUST be odd: size = 2*k + 1
};

uniform Kernel u_kernel;
uniform bool u_vert;

// texCoord passed from the vertex shader
in vec2 v_texCoord;

// texture
uniform sampler2D u_image;

void main() {
    ivec2 size = textureSize(u_image, 0);
    ivec2 pixelCoord = ivec2(gl_FragCoord.xy - vec2(0.5, 0.5));
    int n = (u_kernel.size - 1) / 2;
    vec4 color = vec4(0);
    for (int i = -n; i <= n; i++) {
        if (u_vert) {
            ivec2 px = pixelCoord + ivec2(0, i);
            if (px.y < 0) {
                px.y = -px.y;
            } else if (px.y >= size.y) {
                px.y = size.y - (px.y - size.y) - 1;
            }
            color += texelFetch(u_image, px, 0) * u_kernel.data[i + n];
        } else {
            ivec2 px = pixelCoord + ivec2(i, 0);
            if (px.x < 0) {
                px.x = -px.x;
            } else if (px.x >= size.x) {
                px.x = size.x - (px.x - size.x) - 1;
            }
            color += texelFetch(u_image, px, 0) * u_kernel.data[i + n];
        }
    }
    color.a = 1.0;
    outColor = color;
}
