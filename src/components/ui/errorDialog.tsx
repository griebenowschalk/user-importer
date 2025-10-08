import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

const ErrorDialog = ({
  error,
  onClose,
}: {
  error: string;
  onClose: () => void;
}) => {
  return (
    <Dialog open={!!error} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Error</DialogTitle>
        </DialogHeader>
        <DialogDescription>{error}</DialogDescription>
        <DialogFooter>
          <Button variant="destructive" onClick={onClose}>
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ErrorDialog;
