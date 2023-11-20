export const renderTaskArgs = (taskArgs: any) => " ".concat(
    ...Object.entries(taskArgs)
        .filter(([, argValue]) => argValue !== undefined)
        .map(([argName, argValue]) => `--${argName}=${argValue}`)
)
