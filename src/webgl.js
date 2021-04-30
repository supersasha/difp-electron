import { loadRaw } from './libraw';
import { initUniform } from './glsl-structures.js';
const fs = require('fs');

const vertexShaderSource = fs.readFileSync('./src/vs.glsl');
const fragmentShaderSource = fs.readFileSync('./src/fs.glsl');

const spectrumData = JSON.parse(fs.readFileSync('./data/spectrum-d55-4.json'));
const profileData = JSON.parse(fs.readFileSync('./data/b29-50d.json'));

function createShader(gl, type, source) {
    var shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    var success = gl.getShaderParameter(shader, gl.COMPILE_STATUS);
    if (success) {
        return shader;
    }
    console.log(gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
}

function createProgram(gl, vertexShader, fragmentShader) {
    var program = gl.createProgram();
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

function resizeCanvasToDisplaySize(canvas) {
    // Lookup the size the browser is displaying the canvas in CSS pixels.
    const displayWidth  = canvas.clientWidth;
    const displayHeight = canvas.clientHeight;

    // Check if the canvas is not the same size.
    const needResize = canvas.width  !== displayWidth ||
        canvas.height !== displayHeight;

    if (needResize) {
        // Make the canvas the same size
        canvas.width  = displayWidth;
        canvas.height = displayWidth * 3 / 4; //displayHeight;
    }

    return needResize;
}

function main() {
    //console.log(loadRaw('/home/supersasha/Downloads/P7250010.ORF'));

    const img = loadRaw('/home/supersasha/Downloads/P7250010.ORF', { colorSpace: "xyz" });

    const canvas = document.querySelector('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) {
        console.log('No webgl2');
        return;
    }
    console.log('Webgl2!');
    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    // vertex data
    const positionAttributeLocation = gl.getAttribLocation(program, "a_position");
    const texCoordAttributeLocation = gl.getAttribLocation(program, "a_texCoord");

    //initUniform(gl, program, spectrumData, 'u_spectrumData');

    // uniforms
    const imageLocation = gl.getUniformLocation(program, "u_image");
    console.log('imageLocation:', imageLocation);

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    
    // three 2d points
    var positions = [
      -1, -1,
      -1, 1,
      1, 1,
      -1, -1,
      1, -1,
      1, 1,
    ];
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW);

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    gl.enableVertexAttribArray(positionAttributeLocation);

    const size = 2;          // 2 components per iteration
    const type = gl.FLOAT;   // the data is 32bit floats
    const normalize = false; // don't normalize the data
    const stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    const offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        positionAttributeLocation, size, type, normalize, stride, offset);

    // provide texture coordinates for the rectangle.
    var texCoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
        0, 1,
        0, 0,
        1, 0,
        0, 1,
        1, 1,
        1, 0,
    ]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(texCoordAttributeLocation);
    gl.vertexAttribPointer(
        texCoordAttributeLocation, size, type, normalize, stride, offset)

    // Create a texture.
    var texture = gl.createTexture();

    // make unit 0 the active texture uint
    // (ie, the unit all other texture commands will affect
    gl.activeTexture(gl.TEXTURE0 + 0);

    // Bind it to texture unit 0' 2D bind point
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Set the parameters so we don't need mips and so we're not filtering
    // and we don't repeat
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    // Upload the image into the texture.
    gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGB32F,
        img.width, //5200, // width
        img.height, //3904, // height
        0,
        gl.RGB,
        gl.FLOAT,
        new Float32Array(img.image.buffer)
    );

    function draw() {
        const t0 = Date.now();
        resizeCanvasToDisplaySize(gl.canvas);
        gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);

        // Clear the canvas
        gl.clearColor(0, 0, 0, 0);
        gl.clear(gl.COLOR_BUFFER_BIT);

        // Tell it to use our program (pair of shaders)
        gl.useProgram(program);

        // Bind the attribute/buffer set we want.
        gl.bindVertexArray(vao);

        // Tell the shader to get the texture from texture unit 0
        gl.uniform1i(imageLocation, 0);
        
        initUniform(gl, program, spectrumData, 'u_spectrumData');
        initUniform(gl, program, profileData, 'u_profileData');
        initUniform(gl, program, {
            color_corr: [0.09, 0.01, 0.0],
            film_exposure: -1.57,
            paper_exposure: 0.0,
            paper_contrast: 1.80,
            curve_smoo: 0.15,
            mode: '#0',
        }, 'u_userOptions');

        const primitiveType = gl.TRIANGLES;
        const drawOffset = 0;
        const count = 6;
        gl.drawArrays(primitiveType, drawOffset, count);
        console.log('dT =', Date.now() - t0);
    }

    draw();

    const resizeObserver = new ResizeObserver(draw);
    resizeObserver.observe(canvas, {box: 'content-box'});
}

main();

