


export const PropertyMap = ({ coords, title, neighborhood }) => {
  if (!coords) return null;
  const delta = 0.01;
  const bbox = [
    coords.lng - delta,
    coords.lat - delta,
    coords.lng + delta,
    coords.lat + delta,
  ].join('%2C');
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${coords.lat}%2C${coords.lng}`;
  const link = `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=15/${coords.lat}/${coords.lng}`;

  return (
    <div
      className="w-full h-72 sm:h-80 rounded-2xl overflow-hidden border border-[#e6dfd5] relative bg-[#f4efea]"
      data-testid="property-modal-leaflet-map"
    >
      <iframe
        title={`Mapa de ${title}`}
        src={src}
        className="w-full h-full border-0"
        loading="lazy"
      />
      <a
        href={link}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute bottom-3 right-3 text-[11px] bg-white/95 hover:bg-white text-[#1c1c1e] font-semibold px-3 py-1.5 rounded-full shadow border border-[#e6dfd5]"
        data-testid="map-open-full-link"
      >
        Abrir mapa — {neighborhood}
      </a>
    </div>
  );
};

export default PropertyMap;
