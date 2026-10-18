import { Toaster } from "@/components/ui/sonner";
import { useTheme } from "@/hooks/use-theme";

export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-right"
      richColors
      // X para fechar na hora (no computador, arrastar para o lado é ruim)
      closeButton
      toastOptions={{
        closeButtonAriaLabel: "Fechar notificação",
        classNames: {
          // mesmas classes do components/ui/sonner.tsx (este toastOptions substitui o de lá) + espaço para o X
          toast:
            "group toast !pr-11 group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "!left-auto !right-3 !top-[calc(50%-14px)] !h-7 !w-7 ![transform:none] !border-0 !bg-transparent !text-current opacity-75 transition-opacity hover:!bg-black/10 hover:opacity-100",
        },
      }}
    />
  );
}
