'use client';

import type { Control, FieldPath, FieldValues } from 'react-hook-form';

import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type VocationTypeSelectProps<T extends FieldValues> = {
  control: Control<T>;
  name: FieldPath<T>;
  label: string;
  placeholder: string;
  options: { id: number; name: string }[];
};

export function VocationTypeSelect<T extends FieldValues>({
  control,
  name,
  label,
  placeholder,
  options,
}: VocationTypeSelectProps<T>) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select
            value={field.value != null ? String(field.value) : null}
            onValueChange={(value) =>
              field.onChange(value ? Number(value) : null)
            }
          >
            <FormControl>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={placeholder}>
                  {(value: string | null) =>
                    value
                      ? (options.find((item) => String(item.id) === value)
                          ?.name ?? value)
                      : placeholder
                  }
                </SelectValue>
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {options.map((item) => (
                <SelectItem key={item.id} value={String(item.id)}>
                  {item.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
