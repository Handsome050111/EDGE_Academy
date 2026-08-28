const Logo = ({ size = 'full', variant = 'default', className = '', ...props }) => {
  const sizeClasses = {
    compact: 'h-8 w-auto',
    full: 'h-10 w-auto',
  };

  const variantClasses = {
    default: '',
    light: '',
    dark: '',
  };

  return (
    <img
      src="/new-website-logo.png"
      alt="NexAcademy"
      className={`${sizeClasses[size] || sizeClasses.full} ${variantClasses[variant] || ''} object-contain ${className}`.trim()}
      {...props}
    />
  );
};

export default Logo;
