export default function Brand({ inverse = false }) {
  const src = `${process.env.PUBLIC_URL}/bahia-stay-logo-new.png`;
  return (
    <span className={`brand${inverse ? ' brand-inverse' : ''}`}>
      <img
        className="brand-logo"
        src={src}
        alt="Bahia Stay"
        width="2172"
        height="724"
        loading={inverse ? 'lazy' : 'eager'}
        decoding="async"
      />
    </span>
  );
}
