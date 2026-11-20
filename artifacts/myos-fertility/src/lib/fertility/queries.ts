import { queryOptions } from "@tanstack/react-query";
import { getFertilityState } from "./consultation.functions";

export const fertilityStateQuery = (program = "ivf-care") =>
  queryOptions({ queryKey: ["fertility", program], queryFn: () => getFertilityState({ data: { program } }) });
