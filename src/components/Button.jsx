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

import Spinner from './Spinner'

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
  isLoading = false,
  disabled,
  ...rest
}) {
  return (
    <button
      disabled={isLoading || disabled}
      className={`inline-flex items-center justify-center transition-all duration-200 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${variants[variant]} ${sizes[size]} ${className}`}
      {...rest}
    >
      {isLoading ? (
        <span className="flex items-center justify-center gap-2">
          <Spinner size="sm" />
          {children}
        </span>
      ) : (
        children
      )}
    </button>
  )
}

export default Button
