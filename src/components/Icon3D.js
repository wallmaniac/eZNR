import Image from 'next/image';

/**
 * Renders a 3D Icon from /public/icons3d/
 * @param {string} name - Filename (e.g., 'workers.png')
 * @param {number} size - Pixel size (width/height)
 * @param {string} className - Optional CSS class
 * @param {object} style - Optional inline styles
 */
export default function Icon3D({ name, size = 24, className = '', style = {} }) {
  // Check if it's a 3D icon or fall back to emoji if name is just an emoji
  const isEmoji = !name.includes('.') && name.length <= 4;
  
  if (isEmoji) {
    return <span style={{ fontSize: size * 0.8, ...style }} className={className}>{name}</span>;
  }

  // Ensure absolute path from public
  const src = `/icons3d/${name}`;

  return (
    <Image
      src={src}
      alt="Icon"
      width={size}
      height={size}
      className={className}
      style={{ 
        objectFit: 'contain', 
        flexShrink: 0,
        ...style 
      }}
      priority={size > 40} // Priority load for large header icons
    />
  );
}
