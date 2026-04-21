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

  let appliedScale = 1;
  // Some icons have significant transparent padding in their PNG files.
  // We apply a 1.9 scale globally so they visually match other icons at the same bounding box size.
  const paddedIcons = ['Uvjerenja.png'];
  if (paddedIcons.includes(name)) {
    appliedScale = 1.9;
  }

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
        transform: appliedScale !== 1 ? `scale(${appliedScale})` : undefined,
        ...style 
      }}
      priority={size > 40} // Priority load for large header icons
    />
  );
}
