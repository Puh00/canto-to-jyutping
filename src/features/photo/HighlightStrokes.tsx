import type { HighlightStroke } from '../../ocr/prepare-image';

export function HighlightStrokes({ strokes, width, height }: {
  strokes: readonly HighlightStroke[]; width: number; height: number;
}) {
  return <g opacity=".38" fill="#e7aa18" stroke="#e7aa18" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {strokes.map((stroke, index) => <g key={index}>
      <path fill="none" strokeWidth={stroke.width * width}
        d={stroke.points.map((point, i) => (i ? 'L' : 'M') + point.x * width + ' ' + point.y * height).join(' ')} />
      {stroke.points[0] && <circle stroke="none" cx={stroke.points[0].x * width}
        cy={stroke.points[0].y * height} r={stroke.width * width / 2} />}
    </g>)}
  </g>;
}
