import { toast } from 'react-hot-toast';
import { eventBus } from '../events/index.js';

type FeedbackType = 'success' | 'error' | 'info' | 'warning';

interface FeedbackOptions {
  duration?: number;
  id?: string;
}

/**
 * Ecosystem Feedback Orchestration Layer
 */
class FeedbackOrchestrator {
  private static instance: FeedbackOrchestrator;
  
  private constructor() {}

  public static getInstance() {
    if (!FeedbackOrchestrator.instance) {
       FeedbackOrchestrator.instance = new FeedbackOrchestrator();
    }
    return FeedbackOrchestrator.instance;
  }

  public show(message: string, type: FeedbackType = 'info', options?: FeedbackOptions) {
    const defaultDuration = type === 'error' ? 5000 : 3000;
    
    eventBus.publish('system.ui.feedback_shown' as any, {
      organizationId: 'sys',
      userId: 'sys',
      appSource: 'OS_UI',
      metadata: { message, type }
    });

    const style = {
      background: '#0B0F19',
      color: '#F5F7FA',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px',
      fontSize: '13px',
      fontWeight: 500 as const,
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
      padding: '12px 16px',
    };

    switch (type) {
      case 'success':
        toast.success(message, { style, duration: options?.duration || defaultDuration, id: options?.id });
        break;
      case 'error':
        toast.error(message, { style, duration: options?.duration || defaultDuration, id: options?.id });
        break;
      case 'info':
      case 'warning':
        toast(message, { style, duration: options?.duration || defaultDuration, id: options?.id });
        break;
    }
  }

  public success(message: string, options?: FeedbackOptions) {
     this.show(message, 'success', options);
  }

  public error(message: string, options?: FeedbackOptions) {
     this.show(message, 'error', options);
  }

  public info(message: string, options?: FeedbackOptions) {
     this.show(message, 'info', options);
  }

  public loading(message: string, options?: FeedbackOptions) {
    const style = {
      background: '#0B0F19',
      color: '#F5F7FA',
      border: '1px solid rgba(255,255,255,0.1)',
      borderRadius: '16px',
      fontSize: '13px',
      fontWeight: 500 as const,
      boxShadow: '0 20px 40px -10px rgba(0,0,0,0.5)',
      padding: '12px 16px',
    };
    return toast.loading(message, { style, id: options?.id });
  }

  public dismiss(id?: string) {
    toast.dismiss(id);
  }

  // Destructive confirmations should be handled differently (e.g. custom dialogs)
  // but we can abstract it here for OS-level calls in the future.
}

export const feedback = FeedbackOrchestrator.getInstance();
