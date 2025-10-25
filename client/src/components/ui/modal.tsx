import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export function Modal({ isOpen, onClose, children, className, title }: ModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm"
      onClick={onClose}
      data-testid="modal-backdrop"
    >
      <div
        className={cn(
          "relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-background rounded-lg shadow-lg border",
          className
        )}
        onClick={(e) => e.stopPropagation()}
        data-testid="modal-content"
      >
        {/* Close Button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 z-10"
          onClick={onClose}
          data-testid="button-close-modal"
        >
          <X className="h-5 w-5" />
        </Button>

        {/* Title */}
        {title && (
          <div className="border-b px-6 py-4">
            <h2 className="text-2xl font-heading font-bold">{title}</h2>
          </div>
        )}

        {/* Content */}
        <div className="p-6">
          {children}
        </div>
      </div>
    </div>
  );
}
