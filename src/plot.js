import React, { useRef, useEffect, useState } from 'react';
import { Matrix } from './matrix';
import fs from 'fs';

function *linspace(from, to, steps) {
    if (steps < 2) {
        return;
    }
    const d = (to - from) / (steps - 1);
    for (let i = 0; i < steps; i++) {
        yield from + d * i;
    }
}

const xs = Matrix.fromArray([[...linspace(-10, 10, 10000)]]);

const defaultProps = {
    containerStyle: {},
    plotMargin: 60,
    xrange: 'auto', // 'auto' | [x0, x1]
    yrange: 'auto', // 'auto' | [y0, y1]
    plots: [
        {
            xs: xs.toFlatArray(),
            ys: xs.map(x => Math.sin(x)).toFlatArray(),
            style: 'blue',
        },
        {
            xs: xs.toFlatArray(),
            ys: xs.map(x => Math.exp(Math.sin(2*x))).toFlatArray(),
            style: 'green',
        },
        {
            xs: xs.toFlatArray(),
            ys: xs.map(x => Math.exp(x === 0 ? 0 : Math.sin(1/x))).toFlatArray(),
            style: 'red',
        },
    ],
    xmarks: 11,
    xmarkFormat: 'fixed:2',
    ymarks: 11,
    ymarksFormat: 'fixed:2',
    title: "Plot",
};

export function Plot(_props) {
    const props = { ...defaultProps, ..._props };
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    function draw(ctx) {
        function format(n, f) {
            let parts = f.split(':');
            return n.toFixed(parseInt(parts[1]));
        }
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        const marg = props.plotMargin;
        ctx.clearRect(0, 0, width, height);
        ctx.strokeRect(
            marg + 0.5, marg + 0.5,
            width - 2*marg, height - 2*marg
        );
        ctx.font = '16px sans';
        ctx.textAlign = 'center';
        ctx.fillText(props.title, width/2, marg/2);
        let xmin = Infinity;
        let xmax = -Infinity;
        let ymin = Infinity;
        let ymax = -Infinity;
        for (let p of props.plots) {
            for (let x of p.xs) {
                if (x < xmin) {
                    xmin = x;
                }
                if (x > xmax) {
                    xmax = x;
                }
            }
            for (let y of p.ys) {
                if (y < ymin) {
                    ymin = y;
                }
                if (y > ymax) {
                    ymax = y;
                }
            }
        }
        let xrange = props.xrange;
        if (xrange === 'auto') {
            xrange = [xmin, xmax];
        }
        let yrange = props.yrange;
        if (yrange === 'auto') {
            yrange = [ymin, ymax];
        }

        // X marks
        ctx.save();
        ctx.font = '8px sans';
        ctx.textAlign = 'center';
        ctx.lineWidth = 0.1;
        ctx.setLineDash([10, 2]);
        let screenMarks = [...linspace(marg, width - marg, props.xmarks)];
        let plotMarks = [...linspace(xrange[0], xrange[1], props.xmarks)];
        for (let i = 0; i < props.xmarks; i++) {
            ctx.fillText(format(plotMarks[i], props.xmarkFormat), screenMarks[i], height - 0.8*marg);
            ctx.beginPath();
            ctx.moveTo(Math.floor(screenMarks[i])+0.5, height - marg);
            ctx.lineTo(Math.floor(screenMarks[i])+0.5, marg);
            ctx.stroke();
        }
        ctx.restore();

        // Y marks
        ctx.save();
        ctx.font = '8px sans';
        ctx.textAlign = 'right';
        ctx.lineWidth = 0.1;
        ctx.setLineDash([10, 2]);
        screenMarks = [...linspace(height - marg, marg, props.ymarks)];
        plotMarks = [...linspace(yrange[0], yrange[1], props.ymarks)];
        for (let i = 0; i < props.ymarks; i++) {
            ctx.fillText(format(plotMarks[i], props.ymarksFormat), marg-5, screenMarks[i]);
            ctx.beginPath();
            ctx.moveTo(width - marg, Math.floor(screenMarks[i])+0.5);
            ctx.lineTo(marg, Math.floor(screenMarks[i])+0.5);
            ctx.stroke();
        }
        ctx.restore();

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(marg, marg);
        ctx.lineTo(width - marg, marg);
        ctx.lineTo(width - marg, height - marg);
        ctx.lineTo(marg, height - marg);
        ctx.clip();
        for (let p of props.plots) {
            ctx.save();
            ctx.save();
            ctx.translate(marg, marg);
            ctx.scale((width - 2*marg)/ (xrange[1] - xrange[0]), (height - 2*marg)/ (yrange[0] - yrange[1]));
            ctx.translate(-xrange[0], -yrange[1]);
            ctx.beginPath();
            ctx.moveTo(p.xs[0], p.ys[0]);
            for (let i = 1; i < p.xs.length; i++) {
                ctx.lineTo(p.xs[i], p.ys[i]);
            }
            ctx.restore();
            ctx.lineWidth = 1.0;
            ctx.strokeStyle = p.style;
            ctx.stroke();
            ctx.restore();
        }
        ctx.restore();
    }

    useEffect(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        const ctx = canvas.getContext('2d');
        const ro = new ResizeObserver(() => {
            canvas.width  = container.clientWidth;
            canvas.height = container.clientHeight;
            draw(ctx);
        });
        canvas.width  = container.clientWidth;
        canvas.height = container.clientHeight;
        ro.observe(container);
        draw(ctx);
        return () => { 
            ro.disconnect();
        };
    }, []);

    return (
        <div ref={containerRef} style={props.containerStyle}>
            <canvas ref={canvasRef} />
        </div>
    );
}

export function Spectrum31Plot(props) {
    const xs = [...linspace(400, 700, 31)];
    return (
        <Plot
            {...props}
            plots={props.data.map(d => (
                {
                    xs,
                    ys: d.ys,
                    style: d.style
                }
            ))}
            xmarks={31}
            xmarkFormat="fixed:0"
        />
    );
}

export function ProfilePlot(props) {
    const data = JSON.parse(fs.readFileSync(props.path))[props.what];
    return (
        <Spectrum31Plot
            {...props}
            data={[
                {
                    ys: data[0],
                    style: 'cyan',
                },
                {
                    ys: data[1],
                    style: 'magenta',
                },
                {
                    ys: data[2],
                    style: 'yellow',
                },
            ]}
        />
    );
}
