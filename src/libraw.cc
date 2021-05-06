#include <napi.h>
#include <libraw/libraw.h>
#include <string>

Napi::Value loadRaw(const Napi::CallbackInfo& info)
{
    Napi::Env env = info.Env();
    if (info.Length() < 1) {
        Napi::TypeError::New(env, "Wrong number of arguments")
            .ThrowAsJavaScriptException();
        return env.Null();
    }

    if (!info[0].IsString()) {
        Napi::TypeError::New(env, "Wrong arguments").ThrowAsJavaScriptException();
        return env.Null();
    }

    int outputColor = 5;
    bool halfSize = 0;
    if (info.Length() == 2 && info[1].IsObject()) {
        auto options = info[1].As<Napi::Object>();
        if (options.Has("colorSpace")) {
            auto colorSpace = std::string(options.Get("colorSpace").As<Napi::String>());
            if (colorSpace == "raw") {
                outputColor = 0;
            } else if (colorSpace == "srgb") {
                outputColor = 1;
            } else if (colorSpace == "adobe") {
                outputColor = 2;
            } else if (colorSpace == "wide") {
                outputColor = 3;
            } else if (colorSpace == "prophoto") {
                outputColor = 4;
            } else if (colorSpace == "xyz") {
                outputColor = 5;
            } else if (colorSpace == "aces") {
                outputColor = 6;
            }
        }
        if (options.Has("halfSize")) {
            halfSize = options.Get("halfSize").As<Napi::Boolean>();
        }
    }

    std::string filename = info[0].As<Napi::String>();

    LibRaw raw;
    raw.imgdata.params.output_color = outputColor;
    raw.imgdata.params.output_bps = 16;
    raw.imgdata.params.user_qual = 3;
    raw.imgdata.params.highlight = 0;
    raw.imgdata.params.no_auto_bright = 1;
    //raw.imgdata.params.no_auto_scale = 1; //
    //raw.imgdata.params.fbdd_noiserd = 2;
    raw.imgdata.params.threshold = 100;
    
    /*
    raw.imgdata.params.use_camera_wb = 0;
    raw.imgdata.params.use_camera_matrix = 0;
    */

    //raw.imgdata.params.auto_bright_thr = 0.0001;
    
    raw.imgdata.params.gamm[0] = 1.0; //1.0 / 2.4;
    raw.imgdata.params.gamm[1] = 1.0; //12.92;

    //raw.imgdata.params.aber[0] = 1.001;
    //raw.imgdata.params.aber[1] = 1.001;
    
    raw.imgdata.params.half_size = halfSize ? 1 : 0;

    raw.open_file(filename.c_str());
    raw.unpack();
    raw.dcraw_process();
    auto * mi = raw.dcraw_make_mem_image();
    
    //Image img(mi->width, mi->height);

    /* TODO: think of it!!! Maybe new Canons are kind unusual?
    int srcPixelSize = mi->colors * (mi->bits / 8);
    int srcRedOffset = 0;
    int srcGreenOffset = (mi->bits / 8);
    int srcBlueOffset = 2 * (mi->bits / 8);
    */
    float q = 1.0 / ((1 << mi->bits) - 1);

    auto buf = Napi::Buffer<float>::New(env, mi->width * mi->height * 3);
    float * data = buf.Data();

    for (int row = 0; row < mi->height; row++) {
        int rowOrigin = row * mi->width;
        int srcRowOrigin = row * mi->width * mi->colors * (mi->bits / 8);
        int srcOffset = 0;
        for (int col = 0; col < mi->width; col++, srcOffset += 6) {
            unsigned short * srcPixel =
                (unsigned short *) (mi->data + srcRowOrigin + srcOffset);
            int pixelOrigin = (rowOrigin + col) * 3;
            data[pixelOrigin + 0] = q * srcPixel[0];
            data[pixelOrigin + 1] = q * srcPixel[1];
            data[pixelOrigin + 2] = q * srcPixel[2];
        }
    }

    Napi::Object obj = Napi::Object::New(env);
    obj.Set("image", buf);
    obj.Set("width", Napi::Number::New(env, mi->width));
    obj.Set("height", Napi::Number::New(env, mi->height));
    
    raw.dcraw_clear_mem(mi);
    return obj;
}

Napi::Object Init(Napi::Env env, Napi::Object exports)
{
    exports.Set(Napi::String::New(env, "loadRaw"),
                Napi::Function::New(env, loadRaw));
    return exports;
}

NODE_API_MODULE(addon, Init)
