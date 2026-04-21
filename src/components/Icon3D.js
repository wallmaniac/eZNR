import Image from 'next/image';

/**
 * Renders a 3D Icon from /public/icons3d/
 * @param {string} name - Filename (e.g., 'workers.png')
 * @param {number} size - Pixel size (width/height)
 * @param {string} className - Optional CSS class
 * @param {object} style - Optional inline styles
 */
export default function Icon3D({ name, size = 24, className = '', style = {} }) {
  if (!name) return null;

  // Check if it's a 3D icon or fall back to emoji.
  // We determine it's a file if it contains a dot (extension). Emojis don't have dots.
  const isEmoji = !name.includes('.');
  
  if (isEmoji) {
    return (
      <span 
        style={{ 
          fontSize: size * 0.85, 
          display: 'inline-flex', 
          alignItems: 'center', 
          justifyContent: 'center', 
          width: size, 
          height: size,
          lineHeight: 1,
          ...style 
        }} 
        className={className}
      >
        {name}
      </span>
    );
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
