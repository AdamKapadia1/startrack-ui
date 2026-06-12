interface SkeletonProps {
  width?:        string;
  height?:       string;
  borderRadius?: string;
  className?:    string;
  style?:        React.CSSProperties;
}

export function Skeleton({
  width        = '100%',
  height       = '20px',
  borderRadius = '4px',
  className    = '',
  style,
}: SkeletonProps) {
  return (
    <div
      className={`skeleton${className ? ` ${className}` : ''}`}
      style={{ width, height, borderRadius, ...style }}
    />
  );
}
