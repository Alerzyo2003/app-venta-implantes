import type { ComponentProps, ReactNode } from 'react';

export const controlClasses =
  'block w-full rounded-lg border border-line bg-card px-3 py-2 text-sm text-fg shadow-xs ' +
  'placeholder:text-fg-muted focus:border-primary focus:outline-2 focus:outline-accent ' +
  'aria-[invalid=true]:border-danger disabled:cursor-not-allowed disabled:opacity-60';

interface FieldMeta {
  label: ReactNode;
  name: string;
  /** Identificador del control; por defecto, el nombre (debe ser único en la página). */
  id?: string;
  error?: string;
  hint?: ReactNode;
  required?: boolean;
  className?: string;
}

function describedBy(id: string, error?: string, hint?: ReactNode): string | undefined {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(' ') : undefined;
}

export function Field({ label, name, id = name, error, hint, required, className = '', children }: FieldMeta & { children: ReactNode }) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label htmlFor={id} className="text-sm font-medium text-fg">
        {label}
        {required ? (
          <span aria-hidden className="text-danger">
            {' '}*
          </span>
        ) : null}
      </label>
      {children}
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-fg-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

type InputProps = FieldMeta & Omit<ComponentProps<'input'>, 'name' | 'id'>;

export function TextInput({ label, name, id = name, error, hint, required, className, ...props }: InputProps) {
  return (
    <Field label={label} name={name} id={id} error={error} hint={hint} required={required} className={className}>
      <input
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={controlClasses}
        {...props}
      />
    </Field>
  );
}

type TextAreaProps = FieldMeta & Omit<ComponentProps<'textarea'>, 'name' | 'id'>;

export function TextArea({ label, name, id = name, error, hint, required, className, rows = 4, ...props }: TextAreaProps) {
  return (
    <Field label={label} name={name} id={id} error={error} hint={hint} required={required} className={className}>
      <textarea
        id={id}
        name={name}
        rows={rows}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={controlClasses}
        {...props}
      />
    </Field>
  );
}

export interface Option {
  value: string;
  label: string;
}

type SelectProps = FieldMeta &
  Omit<ComponentProps<'select'>, 'name' | 'id' | 'children'> & { options: readonly Option[]; placeholder?: string };

export function SelectInput({ label, name, id = name, error, hint, required, className, options, placeholder, ...props }: SelectProps) {
  return (
    <Field label={label} name={name} id={id} error={error} hint={hint} required={required} className={className}>
      <select
        id={id}
        name={name}
        required={required}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, error, hint)}
        className={controlClasses}
        {...props}>
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

type CheckboxProps = Omit<ComponentProps<'input'>, 'name' | 'id' | 'type'> & {
  name: string;
  label: ReactNode;
  hint?: ReactNode;
};

export function Checkbox({ name, label, hint, ...props }: CheckboxProps) {
  return (
    <div className="flex items-start gap-3">
      <input
        id={name}
        name={name}
        type="checkbox"
        aria-describedby={hint ? `${name}-hint` : undefined}
        className="mt-0.5 size-4 rounded border-line accent-primary"
        {...props}
      />
      <div className="flex flex-col gap-0.5">
        <label htmlFor={name} className="text-sm font-medium text-fg">
          {label}
        </label>
        {hint ? (
          <p id={`${name}-hint`} className="text-xs text-fg-muted">
            {hint}
          </p>
        ) : null}
      </div>
    </div>
  );
}
