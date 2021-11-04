import * as React from 'react';
import { useRef, useEffect } from 'react';
import { Matrix } from './matrix';
import * as fs from 'fs';
import { linspace } from './generators';

const xs = Matrix.fromArray([[...linspace(-10, 10, 10000)]]);

export interface PlotSpec {
    xs: number[];
    ys: number[];
    style: string;
}

export interface PlotProps {
    containerStyle: any;
    plotMargin: number;
    xrange: 'auto' | [number, number];
    yrange: 'auto' | [number, number];
    plots: PlotSpec[];
    xmarks: number;
    xmarkFormat: string;
    ymarks: number;
    ymarkFormat: string;
    title: string;
    lineWidth: number;
}

const defaultProps: PlotProps = {
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
    ymarkFormat: 'fixed:2',
    title: "Plot",
    lineWidth: 1,
};

export function Plot(_props: Partial<PlotProps>): React.ReactElement {
    const props = { ...defaultProps, ..._props };
    const containerRef = useRef(null);
    const canvasRef = useRef(null);

    function draw(ctx: CanvasRenderingContext2D): void {
        function format(n: number, f: string): string {
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
        if (xmin === xmax) {
            xmin = xmin - 1;
            xmax = xmax + 1;
        }
        if (ymin === ymax) {
            ymin = ymin - 1;
            ymax = ymax + 1;
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
            ctx.fillText(format(plotMarks[i], props.ymarkFormat), marg-5, screenMarks[i]);
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
            ctx.lineWidth = props.lineWidth;
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

    useEffect(() => {
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        draw(ctx);
    });

    return (
        <div ref={containerRef} style={props.containerStyle}>
            <canvas ref={canvasRef} />
        </div>
    );
}

export interface Spectrum31PlotSpec {
    ys: number[];
    style: string;
}

export interface Spectrum31PlotProps extends PlotProps {
    data: Spectrum31PlotSpec[];
}

export function Spectrum31Plot(props: Partial<Spectrum31PlotProps>): React.ReactElement {
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

export interface ProfilePlotProps extends Spectrum31PlotProps {
    path: string;
    what: string;
}

export function ProfilePlot(props: Partial<ProfilePlotProps>): React.ReactElement {
    const data = JSON.parse(fs.readFileSync(props.path, { encoding: 'utf8' }))[props.what];
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
