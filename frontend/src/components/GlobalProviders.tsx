"use client";
import { createContext, useContext, ReactNode } from 'react';
import { useToast } from '@/hooks/useToast';
import { useConfirm } from '@/hooks/useConfirm';
import { ToastContainer } from './ToastContainer';
import { ConfirmModal } from './ConfirmModal';

interface GlobalContextType {
  toast: ReturnType<typeof useToast>;
  confirm: ReturnType<typeof useConfirm>;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export function useGlobalContext() {
  const context = useContext(GlobalContext);
  if (!context) {
    throw new Error('useGlobalContext must be used within GlobalProviders');
  }
  return context;
}

export function GlobalProviders({ children }: { children: ReactNode }) {
  const toast = useToast();
  const confirm = useConfirm();

  return (
    <GlobalContext.Provider value={{ toast, confirm }}>
      {children}
      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />
      <ConfirmModal
        isOpen={confirm.confirmState.isOpen}
        title={confirm.confirmState.title}
        message={confirm.confirmState.message}
        confirmText={confirm.confirmState.confirmText}
        cancelText={confirm.confirmState.cancelText}
        variant={confirm.confirmState.variant}
        onConfirm={confirm.handleConfirm}
        onCancel={confirm.cancel}
      />
    </GlobalContext.Provider>
  );
}

