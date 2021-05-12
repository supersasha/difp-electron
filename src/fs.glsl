#version 300 es
// ^ MUST be the first line


// fragment shaders don't have a default precision so we need
// to pick one. highp is a good default. It means "high precision"
precision highp float;

struct Arr31 {
    float a[31];
};

struct Arr3 {
    float a[3];
};

struct SpectrumData {
    float wp[2];
    float light[31];
    Arr31 base[3];
    Arr3 tri_to_v_mtx[3];
};

uniform SpectrumData u_spectrumData;

struct ProfileData
{
    Arr31 film_sense[3];
    Arr31 film_dyes[3];
    Arr31 paper_sense[3];
    Arr31 paper_dyes[3];

    Arr31 couplers[3];
    float proj_light[31];
    float dev_light[31];
    Arr31 mtx_refl[3];

    float neg_gammas[3];
    float paper_gammas[3];
    float film_max_qs[3];
};

uniform ProfileData u_profileData;

struct UserOptions
{
    float color_corr[3];
    float film_exposure;
    float paper_exposure;
    float paper_contrast;
    float curve_smoo;
    //int negative;
    int mode;
    int channel;
    int frame_horz;
    int frame_vert;
};

uniform UserOptions u_userOptions;

// texture
uniform sampler2D u_image;

// texCoord passed from the vertex shader
in vec2 v_texCoord;
 
// we need to declare an output for the fragment shader
out vec4 outColor;

vec4 xyz_to_srgb_scalar(vec4 c)
{
    float x = c.x / 100.0;
    float y = c.y / 100.0;
    float z = c.z / 100.0;

    // D65
    float r = x *  3.2406 + y * -1.5372 + z * -0.4986;
    float g = x * -0.9689 + y *  1.8758 + z *  0.0415;
    float b = x *  0.0557 + y * -0.2040 + z *  1.0570;

    // D55
    /*
    float r = x * 2.93537622  + y * -1.39242205 + z * -0.45159634;
    float g = x * -0.98211899 + y * 1.90088771  + z *  0.04210707;
    float b = x * 0.06757551  + y * -0.24777685 + z *  1.2839346; 
    */

    // D50
    /*
    float r =  x * 3.1338561 - y * 1.6168667 - z * 0.4906146;
    float g = -x * 0.9787684 + y * 1.9161415 + z * 0.0334540;
    float b =  x * 0.0719453 - y * 0.2289914 + z * 1.4052427;
    */

    if(r > 0.0031308) {
        r = 1.055 * pow(r, 1.0 / 2.4) - 0.055;
    } else {
        r = 12.92f * r;
    }

    if(g > 0.0031308f) {
        g = 1.055 * pow(g, 1.0 / 2.4) - 0.055;
    } else {
        g = 12.92 * g;
    }

    if(b > 0.0031308) {
        b = 1.055 * pow(b, 1.0 / 2.4) - 0.055;
    } else {
        b = 12.92 * b;
    }

    if(r < 0.0) {
        r = 0.0;
    } else if(r > 1.0) {
        r = 1.0;
    }

    if(g < 0.0) {
        g = 0.0;
    } else if(g > 1.0) {
        g = 1.0;
    }

    if(b < 0.0) {
        b = 0.0;
    } else if(b > 1.0) {
        b = 1.0;
    }

    return vec4(r, g, b, 1.0);
}

float sigma(float x, float ymin, float ymax, float gamma, float bias, float smoo)
{
    float a = (ymax - ymin) / 2.0;
    float y = gamma * (x - bias) / a;
    return a * (y / pow(1.0 + pow(abs(y), 1.0/smoo), smoo) + 1.0) + ymin;
}

float sigma_to(float x, float ymin, float ymax, float gamma, float smoo, float x1)
{
    float avg = (ymax + ymin) / 2.0;

    // gamma * (x1 - bias) + avg = ymax
    
    float bias = x1 - (ymax - avg) / gamma;
    return sigma(x, ymin, ymax, gamma, bias, smoo);
}

const int NUM_SECTORS = 6;
const int NUM_BASES = NUM_SECTORS + 1;
const float BLUE_CHROMA_SEPARATION = 0.16;
const int SPECTRUM_SIZE = 31;
const float MIN_REFLECTION = 1.0e-15;

const int NORMAL = 0;
const int NEGATIVE = 1;
const int IDENTITY = 2;
const int FILM_EXPOSURE = 3;
const int GEN_SPECTR = 4;
const int FILM_DEV = 5;
const int PAPER_EXPOSURE = 6;
const int FILM_NEG_LOG_EXP = 7;
const int PAPER_NEG_LOG_EXP = 8;

vec4 log10(vec4 x) {
    return log(x) / log(10.0);
}

vec4 process_photo(vec4 xyz) {
    if (u_userOptions.mode == IDENTITY) {
        return xyz_to_srgb_scalar(xyz * pow(10.0, u_userOptions.film_exposure));
    }

#define B(i, j) (u_spectrumData.base[i].a[j])
#define T(i, j) (u_spectrumData.tri_to_v_mtx[i].a[j])
    vec4 v = vec4(
        T(0, 0)*xyz.x + T(0, 1)*xyz.y + T(0, 2)*xyz.z,
        T(1, 0)*xyz.x + T(1, 1)*xyz.y + T(1, 2)*xyz.z,
        T(2, 0)*xyz.x + T(2, 1)*xyz.y + T(2, 2)*xyz.z,
        0
    );

    vec4 zzz = vec4(0.0);
    // Film development
    vec4 exposure = vec4(0.0, 0.0, 0.0, 1.0);
    for (int i = 0; i < SPECTRUM_SIZE; i++) {
        float refl = B(0, i)*v.x + B(1, i)*v.y + B(2, i)*v.z;
        if (refl < MIN_REFLECTION) {
            refl = MIN_REFLECTION;
        } else if (refl > 1.0) {
            refl = 1.0;
        }
        float sp = refl * 1.0 * u_profileData.dev_light[i]; //sd->light[i];
        
        if (u_userOptions.mode == GEN_SPECTR) {
            zzz.x += u_profileData.mtx_refl[0].a[i] * refl;
            zzz.y += u_profileData.mtx_refl[1].a[i] * refl;
            zzz.z += u_profileData.mtx_refl[2].a[i] * refl;
        }

        exposure.x += pow(10.0, u_profileData.film_sense[0].a[i]) * sp;
        exposure.y += pow(10.0, u_profileData.film_sense[1].a[i]) * sp;
        exposure.z += pow(10.0, u_profileData.film_sense[2].a[i]) * sp;
    }
    
    if (u_userOptions.mode == GEN_SPECTR) {
        return xyz_to_srgb_scalar(zzz);
    }

    if (u_userOptions.mode == FILM_EXPOSURE) {
        return exposure * pow(10.0, u_userOptions.film_exposure);
    }

    vec4 H = log10(exposure) + u_userOptions.film_exposure;

    if (u_userOptions.mode == FILM_NEG_LOG_EXP) {
        return vec4(
            H.x < 0.0 ? 1.0 : 0.0,
            H.y < 0.0 ? 1.0 : 0.0,
            H.z < 0.0 ? 1.0 : 0.0,
            0.0
        );
    }
    
    vec4 dev = vec4(
        sigma_to(H.x, 0.0, 2.5, u_profileData.neg_gammas[0], u_userOptions.curve_smoo, 0.0),
        sigma_to(H.y, 0.0, 2.5, u_profileData.neg_gammas[1], u_userOptions.curve_smoo, 0.0),
        sigma_to(H.z, 0.0, 2.5, u_profileData.neg_gammas[2], u_userOptions.curve_smoo, 0.0),
        0.0
    );

    if (u_userOptions.mode == FILM_DEV) {
        return dev;
    }

    vec4 xyz1 = vec4(0.0);

    // Paper development
    exposure = vec4(0, 0, 0, 1);
    for (int i = 0; i < SPECTRUM_SIZE; i++) {
        float developed_dyes = u_profileData.film_dyes[0].a[i] * dev.x
                             + u_profileData.film_dyes[1].a[i] * dev.y
                             + u_profileData.film_dyes[2].a[i] * dev.z
                             ;
        float developed_couplers = u_profileData.couplers[0].a[i] * (1.0 - dev.x / 2.5)
                                 + u_profileData.couplers[1].a[i] * (1.0 - dev.y / 2.5)
                                 + u_profileData.couplers[2].a[i] * (1.0 - dev.z / 2.5);
        float developed = developed_dyes + developed_couplers;
        float trans = pow(10.0, -developed);
        if (u_userOptions.mode == NEGATIVE) {
            xyz1.x += u_profileData.mtx_refl[0].a[i] * trans;
            xyz1.y += u_profileData.mtx_refl[1].a[i] * trans;
            xyz1.z += u_profileData.mtx_refl[2].a[i] * trans;
        } else {
            float sp = trans * u_profileData.proj_light[i];
            exposure.x += pow(10.0, u_profileData.paper_sense[0].a[i] + u_userOptions.color_corr[0]) * sp;
            exposure.y += pow(10.0, u_profileData.paper_sense[1].a[i] + u_userOptions.color_corr[1]) * sp;
            exposure.z += pow(10.0, u_profileData.paper_sense[2].a[i] + u_userOptions.color_corr[2]) * sp;
        }
    }
    if (u_userOptions.mode == PAPER_EXPOSURE) {
        return exposure * pow(10.0, u_userOptions.paper_exposure);
    }
    
    if (u_userOptions.mode != NEGATIVE) {
        H = log10(exposure) + u_userOptions.paper_exposure;
    
        if (u_userOptions.mode == PAPER_NEG_LOG_EXP) {
            return vec4(
                ((H.x < 0.0) ? 1 : 0),
                ((H.y < 0.0) ? 1 : 0),
                ((H.z < 0.0) ? 1 : 0),
                0
            );
        }
        // Viewing paper
        for (int i = 0; i < SPECTRUM_SIZE; i++) {
            float r = sigma_to(H.x, 0.05, 4.0, u_profileData.paper_gammas[0] * u_userOptions.paper_contrast, u_userOptions.curve_smoo, u_profileData.film_max_qs[0]);
            float g = sigma_to(H.y, 0.05, 4.0, u_profileData.paper_gammas[1] * u_userOptions.paper_contrast, u_userOptions.curve_smoo, u_profileData.film_max_qs[1]);
            float b = sigma_to(H.z, 0.05, 4.0, u_profileData.paper_gammas[2] * u_userOptions.paper_contrast, u_userOptions.curve_smoo, u_profileData.film_max_qs[2]);
            float developed = u_profileData.paper_dyes[0].a[i] * r
                            + u_profileData.paper_dyes[1].a[i] * g
                            + u_profileData.paper_dyes[2].a[i] * b;
            float trans = pow(10.0, -developed * 1.0);
            xyz1.x += u_profileData.mtx_refl[0].a[i] * trans;
            xyz1.y += u_profileData.mtx_refl[1].a[i] * trans;
            xyz1.z += u_profileData.mtx_refl[2].a[i] * trans;
        }
    }
    
    // Setting output color sRGB
    return xyz_to_srgb_scalar(xyz1 * 1.0);
}

void main() {
    // Just set the output to a constant reddish-purple
    vec4 xyz = texture(u_image, v_texCoord);

    // REMOVE the next 3 lines later
    /*
    float kkk = u_spectrumData.wp[1] / u_spectrumData.wp[1];
    kkk *= u_profileData.couplers[0].a[0] / u_profileData.couplers[0].a[0];
    kkk *= u_userOptions.curve_smoo / u_userOptions.curve_smoo;
    */
    outColor = process_photo(100.0 * xyz); 
}
