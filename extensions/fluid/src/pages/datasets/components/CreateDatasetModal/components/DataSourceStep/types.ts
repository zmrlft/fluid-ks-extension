export interface Mount {
  mountPoint: string;
  name: string;
  path: string;
  readOnly: boolean;
  shared: boolean;
  options: Array<{ key: string; value: string }>;
}

export interface MountItemProps {
  mount: Mount;
  index: number;
  canDelete: boolean;
  onUpdate: (index: number, field: keyof Mount, value: any) => void;
  onRemove: (index: number) => void;
}

export interface AddMountButtonProps {
  onAdd: () => void;
}
