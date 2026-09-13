export type ProjectActionState = {
  status: 'idle' | 'success' | 'error';
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
};

export const initialProjectActionState: ProjectActionState = { status: 'idle' };
