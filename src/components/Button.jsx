/**
 * Button — A reusable button component with variant support.
 *
 * Props:
 *   - children: Button label / content
 *   - variant: 'primary' | 'secondary' | 'outline' (default: 'primary')
 *   - size: 'sm' | 'md' | 'lg' (default: 'md')
 *   - className: Additional Tailwind classes
 *   - ...rest: Any native button props (onClick, type, disabled, etc.)
 */

const variants = {
  primary:
    'bg-accent hover:bg-accent-dark text-primary-dark font-semibold shadow-md hover:shadow-lg',
  secondary:
    'bg-primary hover:bg-primary-light text-white font-semibold shadow-md hover:shadow-lg',
  outline:
    'border-2 border-primary text-primary hover:bg-primary hover:text-white font-semibold',
}

const sizes = {
  sm: 'px-3 py-1.5 text-xs rounded-md',
  md: 'px-5 py-2.5 text-sm rounded-lg',
  lg: 'px-7 py-3 text-base rounded-xl',
}

function Button({
  children,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}) {
  return (
    <button
      className={`inline-flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export default Button
