import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import { ConfirmDialog, ConfirmDialogOptions } from '../components/common/ConfirmDialog';

interface DialogContextValue {
  confirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  notify: (options: Omit<ConfirmDialogOptions, 'confirmOnly'>) => Promise<void>;
}

const DialogContext = createContext<DialogContextValue | undefined>(undefined);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ConfirmDialogOptions | null>(null);
  const resolveRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((options: ConfirmDialogOptions) => {
    return new Promise<boolean>((resolve) => {
      resolveRef.current = resolve;
      setState(options);
    });
  }, []);

  const notify = useCallback(
    async (options: Omit<ConfirmDialogOptions, 'confirmOnly'>) => {
      await confirm({ ...options, confirmOnly: true });
    },
    [confirm]
  );

  const handleClose = (result: boolean) => {
    setState(null);
    resolveRef.current?.(result);
    resolveRef.current = null;
  };

  return (
    <DialogContext.Provider value={{ confirm, notify }}>
      {children}
      {state && <ConfirmDialog {...state} onCancel={() => handleClose(false)} onConfirm={() => handleClose(true)} />}
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogContextValue {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialog must be used within a DialogProvider');
  return ctx;
}
