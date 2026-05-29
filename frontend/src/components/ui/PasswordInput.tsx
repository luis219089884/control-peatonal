import { useState } from 'react'

interface PasswordInputProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  id?: string
}

export default function PasswordInput({
  value,
  onChange,
  placeholder = '',
  className = '',
  id,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false)

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={visible ? 'off' : 'new-password'}
        className={`input-field pr-10 ${className}`.trim()}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setVisible(v => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1a3a6b] transition-colors p-0.5"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        title={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
      >
        {visible ? (
          <span className="text-base leading-none" aria-hidden>🙈</span>
        ) : (
          <span className="text-base leading-none" aria-hidden>👁</span>
        )}
      </button>
    </div>
  )
}
