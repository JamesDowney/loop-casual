import { printHtml } from "kolmafia";

/**
 * Specification for an argument that takes values in T.
 * @member key The key to use when parsing this argument.
 * @member help Description for the help text.
 * @member options An array of allowable values for this argument.
 *    Each entry has an optional description for the help text as well.
 * @member default A default value to use if no value is provided.
 *    Note that 'default' is effectively optional, as all methods that take
 *    an ArgSpec allow for 'default' to be omitted. But it is typed as
 *    non-optional here to enable cool type inference voodoo.
 */
interface ArgSpec<T> {
  key?: Exclude<string, "help">;
  help?: string;
  options?: [T, string?][];
  default: T;
}
/**
 * Allow the default argument to be optional, in a way that allows for cool type inference.
 */
type ArgSpecNoDefault<T> = Omit<ArgSpec<T>, "default">;

/**
 * A parser that can transform a string value into the desired type.
 * It may return undefined if given an invalid value.
 */
type Parser<T> = (value: string) => T | undefined;

/**
 * An argument that takes values in T.
 * @member parser The parser to use to built T values.
 * @member valueHelpName The string name of T, e.g. NUMBER.
 */
interface Arg<T> extends ArgSpec<T> {
  parser: Parser<T>;
  valueHelpName: string;
}
/**
 * Allow the default argument to be optional, in a way that allows for cool type inference.
 */
type ArgNoDefault<T> = Omit<Arg<T>, "default">;

/**
 * Create an argument for a custom type.
 * @param spec Specification for this argument.
 * @param parser A function to parse a string value into the proper type.
 * @param valueName The name of this type, for the help text.
 * @returns An argument.
 */
export function arg<T>(spec: ArgSpec<T>, parser: Parser<T>, valueName: string): Arg<T>;
export function arg<T>(
  spec: ArgSpecNoDefault<T>,
  parser: Parser<T>,
  valueHelpName: string
): ArgNoDefault<T>;
export function arg<T>(
  spec: ArgSpec<T> | ArgSpecNoDefault<T>,
  parser: Parser<T>,
  valueHelpName: string
): Arg<T> | ArgNoDefault<T> {
  if ("default" in spec && spec.options) {
    if (!spec.options.map((option) => option[0]).includes(spec.default)) {
      throw `Invalid default value ${spec.default}`;
    }
  }

  return {
    ...spec,
    valueHelpName: valueHelpName,
    parser: parser,
  };
}

/**
 * Create a string argument.
 * @param spec Specification for this argument. See {@link ArgSpec} for details.
 */
export function string(spec: ArgSpec<string>): Arg<string>;
export function string(spec: ArgSpecNoDefault<string>): ArgNoDefault<string>;
export function string(spec: ArgSpecNoDefault<string>): ArgNoDefault<string> {
  return arg<string>(spec, (value: string) => value, "TEXT");
}

/**
 * Create a number argument.
 * @param spec Specification for this argument. See {@link ArgSpec} for details.
 */
export function number(spec: ArgSpec<number>): Arg<number>;
export function number(spec: ArgSpecNoDefault<number>): ArgNoDefault<number>;
export function number(spec: ArgSpecNoDefault<number>): ArgNoDefault<number> {
  return arg(spec, (value: string) => (isNaN(Number(value)) ? undefined : Number(value)), "NUMBER");
}

/**
 * Create a boolean argument.
 * @param spec Specification for this argument. See {@link ArgSpec} for details.
 */
export function boolean(spec: ArgSpec<boolean>): Arg<boolean>;
export function boolean(spec: ArgSpecNoDefault<boolean>): ArgNoDefault<boolean>;
export function boolean(spec: ArgSpecNoDefault<boolean>): ArgNoDefault<boolean> {
  return arg(
    spec,
    (value: string) => {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      return undefined;
    },
    "BOOLEAN"
  );
}

/**
 * Create a flag.
 * @param spec Specification for this argument. See {@link ArgSpec} for details.
 */
export function flag(spec: ArgSpec<boolean>): Arg<boolean>;
export function flag(spec: ArgSpecNoDefault<boolean>): ArgNoDefault<boolean>;
export function flag(spec: ArgSpecNoDefault<boolean>): ArgNoDefault<boolean> {
  return arg(
    spec,
    (value: string) => {
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      return undefined;
    },
    "FLAG"
  );
}

/**
 * Metadata for the parsed arguments.
 *
 * This information is hidden within the parsed argument object so that it
 * is invisible to the user but available to fill(*) and showHelp(*).
 */
const specSymbol: unique symbol = Symbol("spec");
const scriptSymbol: unique symbol = Symbol("script");
const scriptHelpSymbol: unique symbol = Symbol("scriptHelp");
type ArgMetadata<T extends ArgMap> = {
  [specSymbol]: T;
  [scriptSymbol]: string;
  [scriptHelpSymbol]: string;
};

/**
 * Construct the object type for the parsed arguments with typescript voodoo.
 *
 * The keys for the parsed argument object match the keys from the argument
 * specifications. That is, for each (key: spec) pair in the argument spec
 * object, there is a (key: value) in the parsed argument object.
 *
 * If spec has type Arg<T> (i.e., has a default), then value has type T.
 * If spec has type ArgNoDefault<T>, the value has type T | undefined.
 *
 * Finally, there are hidden keys in ArgMetadata for fill(*) and showHelp(*).
 */
type ArgMap = {
  [key: string]: Arg<unknown> | ArgNoDefault<unknown>;
};
type ParsedArgs<T extends ArgMap> = {
  [k in keyof T]: T[k] extends Arg<unknown>
    ? Exclude<ReturnType<T[k]["parser"]>, undefined>
    : ReturnType<T[k]["parser"]>;
} & ArgMetadata<T>;

/**
 * Create a set of input arguments for a script.
 * @param scriptName Prefix for property names; often the name of the script.
 * @param scriptHelp Brief description of this script, for the help message.
 * @param args A JS object specifying the script arguments. Its values should
 *    be {@link Arg} objects (created by Args.string, Args.number, or others).
 * @returns An object which can hold parsed argument values. The keys of this
 *    object are identical to the keys in 'args'.
 */
export function create<T extends ArgMap>(
  scriptName: string,
  scriptHelp: string,
  args: T
): ParsedArgs<T> & { help: boolean } {
  for (const k in args) {
    if (k === "help" || args[k].key === "help") throw `help is a reserved argument name`;
  }

  const argsWithHelp = {
    ...args,
    help: flag({ help: "Show this message and exit.", default: false }),
  };

  const res: { [key: string]: unknown } & ArgMetadata<T> = {
    [specSymbol]: argsWithHelp,
    [scriptSymbol]: scriptName,
    [scriptHelpSymbol]: scriptHelp,
  };
  for (const k in argsWithHelp) {
    const v = argsWithHelp[k];
    if ("default" in v) res[k] = v["default"];
    else res[k] = undefined;
  }
  return res as ParsedArgs<T> & { help: boolean };
}

/**
 * Parse the command line input into the provided script arguments.
 * @param args An object to hold the parsed argument values, from Args.create(*).
 * @param command The command line input.
 */
export function fill<T extends ArgMap>(args: ParsedArgs<T>, command: string | undefined): void {
  if (command === undefined || command === "") return;

  const spec = args[specSymbol];
  const keys = new Set<string>();
  const flags = new Set<string>();
  for (const k in spec) {
    if (spec[k].valueHelpName === "FLAG") flags.add(spec[k].key ?? k);
    else keys.add(spec[k].key ?? k);
  }

  // Parse new argments from the command line
  const parsed = new CommandParser(command, keys, flags).parse();
  for (const k in spec) {
    const key = spec[k].key ?? k;
    const value_str = parsed.get(key);
    if (value_str === undefined) continue;

    const value = spec[k].parser(value_str);
    if (value === undefined) throw `Argument ${key} could not parse value: ${value_str}`;
    const options = spec[k].options;
    if (options) {
      if (!options.map((option) => option[0]).includes(value)) {
        throw `Argument ${key} received invalid value: ${value_str}`;
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    args[k] = value as any;
  }
}

/**
 * Parse command line input into a new set of script arguments.
 * @param scriptName Prefix to use in property names; typically the name of the script.
 * @param scriptHelp Brief description of this script, for the help message.
 * @param spec An object specifying the script arguments.
 * @param command The command line input.
 */
export function parse<T extends ArgMap>(
  scriptName: string,
  scriptHelp: string,
  spec: T,
  command: string
): ParsedArgs<T> {
  const args = create(scriptName, scriptHelp, spec);
  fill(args, command);
  return args;
}

/**
 * Print a description of the script arguments to the CLI.
 * @param args An object of parsed arguments, from Args.create(*).
 * @param maxOptionsToDisplay If given, do not list more than this many options for each arg.
 */
export function showHelp<T extends ArgMap>(
  args: ParsedArgs<T>,
  maxOptionsToDisplay?: number
): void {
  const spec = args[specSymbol];
  const scriptHelp = args[scriptHelpSymbol];

  printHtml(`${scriptHelp}`);
  printHtml(`<font color='blue'>Options:</font>`);
  for (const k in spec) {
    const arg = spec[k];

    const nameText = arg.key ?? k;
    const valueText = arg.valueHelpName === "FLAG" ? "" : `${arg.valueHelpName}`;
    const helpText = arg.help ?? "";
    const defaultText = "default" in arg ? `[default: ${arg.default}]` : "";

    printHtml(`&nbsp;&nbsp;${[nameText, valueText, "-", helpText, defaultText].join(" ")}`);
    const valueOptions = arg.options ?? [];
    if (valueOptions.length < (maxOptionsToDisplay ?? Number.MAX_VALUE)) {
      for (const option of valueOptions) {
        if (option.length === 1) {
          printHtml(`&nbsp;&nbsp;&nbsp;&nbsp;${nameText} ${option[0]}`);
        } else {
          printHtml(`&nbsp;&nbsp;&nbsp;&nbsp;${nameText} ${option[0]} - ${option[1]}`);
        }
      }
    }
  }
}

/**
 * A parser to extract key/value pairs from a command line input.
 * @member command The command line input.
 * @member keys The set of valid keys that can appear.
 * @member flags The set of valid flags that can appear.
 * @member index An internal marker for the progress of the parser over the input.
 */
class CommandParser {
  private command: string;
  private keys: Set<string>;
  private flags: Set<string>;
  private index: number;
  constructor(command: string, keys: Set<string>, flags: Set<string>) {
    this.command = command;
    this.index = 0;
    this.keys = keys;
    this.flags = flags;
  }

  /**
   * Perform the parsing of (key, value) pairs.
   * @returns The set of extracted (key, value) pairs.
   */
  parse(): Map<string, string> {
    this.index = 0; // reset the parser
    const result = new Map<string, string>();
    while (!this.finished()) {
      // A flag F may appear as !F to be parsed as false.
      let parsing_negative_flag = false;
      if (this.peek() === "!") {
        parsing_negative_flag = true;
        this.consume(["!"]);
      }

      const key = this.parseKey();
      if (result.has(key)) {
        throw `Duplicate key: ${key}`;
      }
      if (this.flags.has(key)) {
        // The key corresponds to a flag.
        // Parse [key] as true and ![key] as false.
        result.set(key, parsing_negative_flag ? "false" : "true");
        if (this.peek() === "=") throw `Flag ${key} cannot be assigned a value`;
        if (!this.finished()) this.consume([" "]);
      } else {
        // Parse [key]=[value] or [key] [value]
        this.consume(["=", " "]);
        const value = this.parseValue();
        if (!this.finished()) this.consume([" "]);
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * @returns True if the entire command has been parsed.
   */
  private finished(): boolean {
    return this.index >= this.command.length;
  }

  /**
   * @returns The next character to parse, if it exists.
   */
  private peek(): string | undefined {
    if (this.index >= this.command.length) return undefined;
    return this.command.charAt(this.index);
  }

  /**
   * Advance the internal marker over the next expected character.
   * Throws an error on unexpected characters.
   *
   * @param allowed Characters that are expected.
   */
  private consume(allowed: string[]) {
    if (this.finished()) throw `Expected ${allowed}`;
    if (allowed.includes(this.peek() ?? "")) {
      this.index += 1;
    }
  }

  /**
   * Find the next occurance of one of the provided characters, or the end of
   * the string if the characters never appear again.
   *
   * @param searchValue The characters to locate.
   */
  private findNext(searchValue: string[]) {
    let result = this.command.length;
    for (const value of searchValue) {
      const index = this.command.indexOf(value, this.index);
      if (index !== -1 && index < result) result = index;
    }
    return result;
  }

  /**
   * Starting from the internal marker, parse a single key.
   * This also advances the internal marker.
   *
   * @returns The next key.
   */
  private parseKey(): string {
    const keyEnd = this.findNext(["=", " "]);
    const key = this.command.substring(this.index, keyEnd);
    this.index = keyEnd;
    if (!this.keys.has(key) && !this.flags.has(key)) {
      throw `Unknown key: ${key}`;
    }
    return key;
  }

  /**
   * Starting from the internal marker, parse a single value.
   * This also advances the internal marker.
   *
   * Values are a single word or enclosed in matching quotes, i.e. one of:
   *    "[^"]*"
   *    '[^']*"
   *    [^'"][^ ]*
   *
   * @returns The next value.
   */
  private parseValue(): string {
    let valueEnder = " ";
    const quotes = ["'", '"'];
    if (quotes.includes(this.peek() ?? "")) {
      valueEnder = this.peek() ?? ""; // The value is everything until the next quote
      this.consume([valueEnder]); // Consume opening quote
    }

    const valueEnd = this.findNext([valueEnder]);
    const value = this.command.substring(this.index, valueEnd);
    if (valueEnder !== " " && valueEnd === this.command.length) {
      throw `No closing ${valueEnder} found for ${valueEnder}${value}`;
    }

    // Consume the value (and closing quote)
    this.index = valueEnd;
    if (valueEnder !== " ") this.consume([valueEnder]);
    return value;
  }
}