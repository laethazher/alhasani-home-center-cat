export type DepartmentCode = 'tajhiz' | 'installation' | 'operations';

export function assertDepartment(value: string): DepartmentCode {
  if (value === 'installation' || value === 'tajhiz' || value === 'operations') return value;
  throw new Error(`Unsupported department: ${value}`);
}
