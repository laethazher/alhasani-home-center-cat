export type DepartmentCode = 'tajhiz' | 'installation';

export function assertDepartment(value: string): DepartmentCode {
  if (value === 'installation' || value === 'tajhiz') return value;
  throw new Error(`Unsupported department: ${value}`);
}
