export function initExtensions(gl: WebGL2RenderingContext): void {
    console.log(gl.getExtension('OES_texture_float_linear'));
    console.log(gl.getExtension('EXT_color_buffer_float'));
    console.log(gl.getExtension('EXT_float_blend'));
}

export function initUniform(gl: WebGL2RenderingContext, program: WebGLProgram, struct: any, path: string): void {
    if (Array.isArray(struct)) {
        const innerArray = path[path.length-1] === ']';
        for (let i = 0; i < struct.length; i++) {
            initUniform(gl, program, struct[i], `${path}${innerArray ? '.a' : ''}[${i}]`);
        }
    } else if (typeof struct === 'object' && struct !== null) {
        for (let key of Object.keys(struct)) {
            initUniform(gl, program, struct[key], `${path}.${key}`);
        }
    } else if (typeof struct === 'boolean') {
        const loc = gl.getUniformLocation(program, path);
        if (!loc) {
            console.error(`Can't locate uniform at ${path}`);
        }
        gl.uniform1i(loc, struct ? 1 : 0);
    } else if (typeof struct === 'string' && struct[0] === '#') {
        const loc = gl.getUniformLocation(program, path);
        if (!loc) {
            console.error(`Can't locate uniform at ${path}`);
        }
        gl.uniform1i(loc, parseInt(struct.slice(1)));
    } else if (typeof struct === 'number') {
        const loc = gl.getUniformLocation(program, path);
        if (!loc) {
            console.error(`Can't locate uniform at ${path}`);
        }
        gl.uniform1f(loc, struct);
    }
}

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    const success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    var success = gl.getProgramParameter(program, gl.LINK_STATUS);
    if (success) {
        return program;
    }

    console.log(gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
}

export class Program {
    gl: WebGL2RenderingContext;
    program: WebGLProgram;
    vao: WebGLVertexArrayObject;
    buffers: { [name: string]: WebGLBuffer };

    constructor(gl: WebGL2RenderingContext, vertexShaderSource: string, fragmentShaderSource: string) {
        //gl.getExtension('OES_texture_float_linear');
        const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
        const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
        this.gl = gl;
        this.program = createProgram(gl, vertexShader, fragmentShader);
        gl.useProgram(this.program);
        this.vao = gl.createVertexArray();
        this.buffers = {};
    }

    getBufferFor(attribName: string): WebGLBuffer {
        const gl = this.gl;
        gl.useProgram(this.program);
        if (!this.buffers[attribName]) {
            this.buffers[attribName] = gl.createBuffer(); 
        }
        return this.buffers[attribName];
    }

    setAttribute(name: string, arr: any[]): void {
        const gl = this.gl;
        gl.useProgram(this.program);
        gl.bindVertexArray(this.vao);
        const loc = gl.getAttribLocation(this.program, name);
        const buffer = this.getBufferFor(name);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(arr.flat()), gl.STATIC_DRAW);
        gl.enableVertexAttribArray(loc);
        
        const size = Array.isArray(arr[0]) ? arr[0].length : 1; // components per iteration
        const type = gl.FLOAT;   // the data is 32bit floats
        const normalize = false; // don't normalize the data
        const stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
        const offset = 0;        // start at the beginning of the buffer
        gl.vertexAttribPointer(loc, size, type, normalize, stride, offset);
    }

    setUniform(name: string, value: any): void { // and also Texture if `value instanceof Texture`
        const gl = this.gl;
        gl.useProgram(this.program);
        if (value instanceof Texture) {
            const loc = gl.getUniformLocation(this.program, name);
            gl.uniform1i(loc, value.unit);
        } else {
            initUniform(gl, this.program, value, name);
        }
    }

    run(target: Framebuffer|null = null): void {
        const gl = this.gl;
        gl.useProgram(this.program);
        if (target) {
            gl.bindFramebuffer(gl.FRAMEBUFFER, target.framebuffer);
            gl.viewport(0, 0, target.texture.width, target.texture.height);
        } else {
            gl.bindFramebuffer(gl.FRAMEBUFFER, null);
            gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
        }
        /*
        const ext1 = gl.getExtension('OES_texture_float_linear');
        const ext2 = gl.getExtension('EXT_color_buffer_float');
        */

        gl.clearColor(1, 1, 1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

        // TODO: make this universal
        const primitiveType = gl.TRIANGLES;
        const drawOffset = 0;
        const count = 6;
        gl.drawArrays(primitiveType, drawOffset, count);

        // REMOVE next line?
        gl.finish();
    }
}

export interface TextureDataOptions {
    minFilter: number;
    magFilter: number;
    alpha: boolean;
}

export class Texture {
    gl: WebGL2RenderingContext;
    unit: number;
    texture: WebGLTexture;
    width: number;
    height: number;

    constructor(gl: WebGL2RenderingContext, unit: number) {
        this.gl = gl;
        this.unit = unit;
        this.texture = gl.createTexture();
    }

    dispose() {
        this.gl.deleteTexture(this.texture);
    }

    setData(width: number, height: number, data = null, options: Partial<TextureDataOptions> = {}): void {
        this.width = width;
        this.height = height;
        const gl = this.gl;

        const opts = {
            minFilter: gl.NEAREST,
            magFilter: gl.NEAREST,
            alpha: true,
            ...options
        };
        /*
        if (opts.minFilter === gl.LINEAR || opts.magFilter === gl.LINEAR) {
            gl.getExtension('OES_texture_float_linear');
        }
        */

        // make unit the active texture uint
        // (ie, the unit all other texture commands will affect
        gl.activeTexture(gl.TEXTURE0 + this.unit);

        // Bind it to texture unit 0' 2D bind point
        gl.bindTexture(gl.TEXTURE_2D, this.texture);

        // Set the parameters so we don't need mips and so we're not filtering
        // and we don't repeat
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, opts.minFilter);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, opts.magFilter);

        // Upload the image into the texture.
        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            opts.alpha ? gl.RGBA32F : gl.RGB32F,
            width,
            height,
            0,
            opts.alpha ? gl.RGBA : gl.RGB,
            gl.FLOAT,
            data
        );
    }
}

export class Framebuffer {
    readonly texture: Texture;
    readonly framebuffer: WebGLFramebuffer;

    private gl: WebGL2RenderingContext;

    constructor(gl: WebGL2RenderingContext, unit: number, width: number, height: number) {
        this.gl = gl;
        this.texture = new Texture(gl, unit);
        this.texture.setData(width, height);
        this.framebuffer = gl.createFramebuffer();
        gl.bindFramebuffer(gl.FRAMEBUFFER, this.framebuffer);
        const attachmentPoint = gl.COLOR_ATTACHMENT0;
        gl.framebufferTexture2D(
            gl.FRAMEBUFFER, attachmentPoint, gl.TEXTURE_2D, this.texture.texture, 0);
    }

    dispose() {
        this.gl.deleteFramebuffer(this.framebuffer);
        this.texture.dispose();
    }
}

