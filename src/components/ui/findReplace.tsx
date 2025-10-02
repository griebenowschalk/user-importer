import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileSearchIcon } from "lucide-react";
import { useState } from "react";
import { Typography } from "./typography";
import { Input } from "./input";
import { Tooltip, TooltipContent, TooltipTrigger } from "./tooltip";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { useForm } from "react-hook-form";
import * as yup from "yup";

interface FindReplaceProps {
  fields: string[];
  onFind: (data: { find: string; field: string; replace?: string }) => void;
}

export function FindReplace({ fields, onFind }: FindReplaceProps) {
  const [open, setOpen] = useState(false);
  const schema = yup.object({
    find: yup.string().required(),
    field: yup.string().required(),
    replace: yup.string().optional(),
  });

  const form = useForm<{
    find: string;
    field: string;
    replace?: string;
  }>({
    resolver: async data => {
      try {
        const values = await schema.validate(data, { abortEarly: false });
        return { values, errors: {} };
      } catch (yupError: any) {
        const errors = (yupError.inner || []).reduce((all: any, curr: any) => {
          all[curr.path] = {
            type: curr.type ?? "validation",
            message: curr.message,
          };
          return all;
        }, {});
        return { values: {}, errors };
      }
    },
    defaultValues: {
      find: "",
      field: "all",
      replace: undefined,
    },
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline">
              <FileSearchIcon />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent className="whitespace-pre-line max-w-[300px]">
          {"Find and replace text in the table"}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="top" align="end" className="w-80">
        <div className="flex flex-col gap-2">
          <div className="space-y-2">
            <Typography as="h4" className="leading-none font-medium">
              Find and Replace
            </Typography>
            {/* <Typography as="p" className="text-muted-foreground text-sm">
              Find and replace text in the table.
            </Typography> */}
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={form.handleSubmit(onFind)}
          >
            <div className="flex flex-col gap-1">
              <div className="flex flex-col gap-1">
                <Typography as="h6">Find</Typography>
                <Input
                  id="find"
                  defaultValue=""
                  className="h-8"
                  {...form.register("find")}
                />
              </div>
              <div className="flex flex-col gap-1">
                <Typography as="h6">Field</Typography>
                <Select
                  onValueChange={value => form.setValue("field", value)}
                  value={form.watch("field")}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="all">All</SelectItem>
                      {fields.map(field => (
                        <SelectItem key={field} value={field}>
                          {field}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <Typography as="h6">Replace</Typography>
                <Input
                  id="replace"
                  defaultValue=""
                  className="h-8"
                  {...form.register("replace")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-1">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Find</Button>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
