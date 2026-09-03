const Logo = ({ size = 'full', variant = 'default', className = '', ...props }) => {
  const sizeClasses = {
    compact: 'h-10 w-auto',
    full: 'h-12 w-auto',
  };

  const variantClasses = {
    default: '',
    light: '',
    dark: '',
  };

  return (
    <img
      src="/NexLogo-1.png"
      alt="NexAcademy"
      className={`${sizeClasses[size] || sizeClasses.full} ${variantClasses[variant] || ''} object-contain ${className}`.trim()}
      {...props}
    />
  );
};

export default Logo;
