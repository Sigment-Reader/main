export type ServerError = {
  log: string;
  status: number;
  message: { err: string };
};

export type ClientRequestBody = {
  query: string;
};
