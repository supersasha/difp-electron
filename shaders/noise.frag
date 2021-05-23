#version 300 es

precision highp float;
//precision highp int;

out vec4 outColor;

uniform uint u_seed;
uniform float u_sigma;

uint hash(uint s) {
    uint hash = 0U;
    for (uint i = 0U; i < 4U; i++) {
        hash += (s >> (i*8U)) & 0xFFU;
        hash += hash << 10U;
        hash ^= hash >> 6U;
    }
    hash += hash << 3U;
    hash ^= hash >> 11U;
    hash += hash << 15U;
    return hash;
}

float uniformRV(uint s) {
    uint h = hash(s);
    if (h == 0U) {
        h = 1U;
    }
    return float(h) / float(0xFFFFFFFFU);
}

const float PI = 3.1415926535897932384626433832795;

float normalRV(vec2 co) {
    uvec2 v = uvec2(co);
    float r = uniformRV(v.x ^ hash(v.y) /*^ u_seed*/);
    float phi = uniformRV(v.y ^ hash(v.x) /*^ u_seed*/);
    float z0 = cos(2.0*PI*phi) * sqrt(-2.0*log(r));
    return u_sigma * z0;
}

void main() {
    float rv = abs(normalRV(gl_FragCoord.xy));
    outColor = vec4(vec3(rv), 1.0);
}
