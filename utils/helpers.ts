export const splitIntoGroups = (arr: string[], groupSize: number) => {
  const groups = [];

  for (let i = 0; i < arr.length; i += groupSize) {
    groups.push(arr.slice(i, i + groupSize));
  }

  return groups;
};
