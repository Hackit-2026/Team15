export type PresentationState = {
  currentPage: number;
  totalPages: number;
  isLoading: boolean;
  isPresenting: boolean;
  error: string | null;
};

export type SlideChangeEvent = {
  presentationId: string;
  currentPage: number;
  totalPages: number;
  timestamp: string;
};

export type SlideChangeHandler = (data: SlideChangeEvent) => void;

export interface SlideSyncAdapter {
  publish(data: SlideChangeEvent): void | Promise<void>;
}
