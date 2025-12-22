import { useEffect, useRef, RefObject } from 'react';

interface UseFocusManagementOptions {
  /**
   * フォーカスを管理する要素のref
   */
  containerRef?: RefObject<HTMLElement | null>;
  /**
   * フォーカストラップを有効にするか
   */
  trapFocus?: boolean;
  /**
   * モーダルが開いたときに最初にフォーカスする要素のセレクタ
   */
  initialFocusSelector?: string;
  /**
   * モーダルが閉じたときにフォーカスを戻す要素のref
   */
  returnFocusRef?: RefObject<HTMLElement>;
  /**
   * フォーカストラップを有効にするかどうか
   */
  enabled?: boolean;
}

/**
 * フォーカス管理のためのカスタムフック
 * モーダルやダイアログでのキーボードナビゲーションを改善
 */
export function useFocusManagement(options: UseFocusManagementOptions = {}) {
  const {
    containerRef,
    trapFocus = false,
    initialFocusSelector,
    returnFocusRef,
    enabled = true,
  } = options;

  const previousActiveElementRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!enabled) return;

    // 現在のアクティブ要素を保存
    previousActiveElementRef.current = document.activeElement as HTMLElement;

    // 初期フォーカスを設定
    if (initialFocusSelector && containerRef?.current) {
      const initialElement = containerRef.current.querySelector(
        initialFocusSelector
      ) as HTMLElement;
      if (initialElement) {
        initialElement.focus();
      }
    }

    // フォーカストラップ
    if (trapFocus && containerRef?.current) {
      const handleTabKey = (e: KeyboardEvent) => {
        if (e.key !== 'Tab') return;

        const focusableElements = containerRef.current?.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;

        if (!focusableElements || focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          // Shift + Tab
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          // Tab
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      };

      document.addEventListener('keydown', handleTabKey);

      return () => {
        document.removeEventListener('keydown', handleTabKey);
        
        // フォーカスを戻す
        if (returnFocusRef?.current) {
          returnFocusRef.current.focus();
        } else if (previousActiveElementRef.current) {
          previousActiveElementRef.current.focus();
        }
      };
    }

    return () => {
      // クリーンアップ時にフォーカスを戻す
      if (returnFocusRef?.current) {
        returnFocusRef.current.focus();
      } else if (previousActiveElementRef.current) {
        previousActiveElementRef.current.focus();
      }
    };
  }, [enabled, trapFocus, containerRef, initialFocusSelector, returnFocusRef]);
}

