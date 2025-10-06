import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FileSearchIcon, XIcon } from "lucide-react";
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
import { Checkbox } from "./checkbox";
import { ActionType } from "@/types";

interface FindReplaceProps {
  fields: string[];
  onFind: (data: {
    find: string;
    field: string;
    exactMatch?: boolean;
    replace?: string;
    actionType: ActionType;
  }) => void;
  clear: () => void;
  matches?: number;
}

export function FindReplace({
  fields,
  onFind,
  clear,
  matches,
}: FindReplaceProps) {
  const [open, setOpen] = useState(false);
  const schema = yup.object({
    find: yup.string().required(),
    field: yup.string().required(),
    exactMatch: yup.boolean().optional(),
    replace: yup.string().optional(),
  });

  const [actionType, setActionType] = useState<ActionType>(ActionType.find);

  const form = useForm<{
    find: string;
    field: string;
    replace?: string;
    exactMatch?: boolean;
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
      exactMatch: undefined,
    },
  });

  return (
    <Popover open={open}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="outline" onClick={() => setOpen(true)}>
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
          <div className="flex flex-row items-start justify-between gap-2">
            <Typography as="h6" className="leading-none font-medium">
              Find and Replace
            </Typography>
            <Button
              className="h-4 p-0 w-4"
              variant="ghost"
              onClick={() => {
                setOpen(false);
                form.reset();
                clear();
              }}
            >
              <XIcon />
            </Button>
          </div>
          <form
            className="flex flex-col gap-2"
            onSubmit={form.handleSubmit(data => {
              onFind({
                ...data,
                actionType,
              });
            })}
          >
            <div className="flex flex-col gap-2">
              <div className="flex flex-col gap-2">
                <Typography as="span">Find</Typography>
                <div className="flex flex-row gap-2">
                  <Input
                    id="find"
                    defaultValue=""
                    className="h-8"
                    {...form.register("find")}
                  />
                  <Button
                    className="h-8"
                    type="submit"
                    onClick={() => setActionType(ActionType.find)}
                  >
                    Find
                  </Button>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Typography as="span">Field</Typography>
                <Select
                  onValueChange={value => form.setValue("field", value)}
                  value={form.watch("field")}
                >
                  <SelectTrigger className="w-full h-8">
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
                <div className="flex flex-row items-center gap-2">
                  <Checkbox
                    checked={form.watch("exactMatch") || false}
                    onCheckedChange={() => {
                      form.setValue("exactMatch", !form.watch("exactMatch"));
                    }}
                  />
                  <Typography as="span">Exact Match</Typography>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                {matches && (
                  <Typography as="span">Matches: {matches}</Typography>
                )}
                <Typography as="span">Replace</Typography>
                <Input
                  id="replace"
                  defaultValue=""
                  className="h-8"
                  {...form.register("replace")}
                />
              </div>
            </div>
            <div className="flex justify-end gap-1">
              <Button
                className="h-8"
                disabled={!matches}
                type="submit"
                onClick={() => setActionType(ActionType.replaceAll)}
              >
                Replace All
              </Button>
            </div>
          </form>
        </div>
      </PopoverContent>
    </Popover>
  );
}
