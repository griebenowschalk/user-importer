import { DownloadIcon } from "lucide-react";
import { Button } from "./button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Typography } from "./typography";
import { useForm } from "react-hook-form";
import * as yup from "yup";
import { Input } from "./input";
import { useState } from "react";

interface DownloadDialogProps {
  onDownload: (fileName: string, format: string) => void;
}

function DownloadDialog({ onDownload }: DownloadDialogProps) {
  const [open, setOpen] = useState(false);
  const schema = yup.object({
    fileName: yup.string().required(),
    format: yup.string().required(),
  });
  const form = useForm<{ fileName: string; format: string }>({
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
  });

  const handleSubmit = (data: any) => {
    onDownload(data.fileName, data.format);
    form.reset();
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <DownloadIcon onClick={() => setOpen(true)} />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Export Data</DialogTitle>
            <DialogDescription>Select export file format</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-3">
              <Typography as="h6">File Name</Typography>
              <Input
                {...form.register("fileName")}
                placeholder="Enter file name"
              />
            </div>
            <div className="grid gap-3">
              <Typography as="h6">File Format</Typography>
            </div>
            <Select onValueChange={value => form.setValue("format", value)}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a format" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>Format</SelectLabel>
                  <SelectItem value="csv">CSV</SelectItem>
                  <SelectItem value="xlsx">XLSX</SelectItem>
                  <SelectItem value="json">JSON</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default DownloadDialog;
