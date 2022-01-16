import { equippedItem, monsterDefense, myBuffedstat, weaponType } from "kolmafia";
import { $item, $skill, $slot, $stat, Macro } from "libram";
import { BanishSource, RunawaySource, WandererSource } from "./resources";

export enum MonsterStrategy {
  RunAway,
  Kill,
  KillHard,
  Banish,
  Abort,
}

export class BuiltCombatStrategy {
  macro: Macro = new Macro();

  use_banish?: Macro;
  use_runaway?: Macro;

  constructor(
    abstract: CombatStrategy,
    wanderers: WandererSource[],
    banish?: BanishSource,
    runaway?: RunawaySource
  ) {
    // Setup special macros
    if (banish?.do instanceof Item) this.use_banish = new Macro().item(banish.do);
    if (banish?.do instanceof Skill) this.use_banish = new Macro().skill(banish.do);
    this.use_runaway = runaway?.do;
    for (const wanderer of wanderers) {
      this.macro = this.macro.if_(wanderer.monster, this.prepare_macro(MonsterStrategy.KillHard));
    }

    // Setup the generic macros
    abstract.macros.forEach((value, key) => {
      this.macro = this.macro.if_(key, value);
    });
    abstract.strategy.forEach((strat, monster) => {
      this.macro = this.macro.if_(monster, this.prepare_macro(strat, monster));
    });
    if (abstract.default_macro) this.macro = this.macro.step(abstract.default_macro);
    this.macro = this.macro.step(this.prepare_macro(abstract.default_strategy));
  }

  public handle_monster(monster: Monster, strategy: MonsterStrategy | Macro): void {
    this.macro = new Macro().if_(monster, this.prepare_macro(strategy, monster)).step(this.macro);
  }

  prepare_macro(strategy: MonsterStrategy | Macro, monster?: Monster): Macro {
    if (strategy instanceof Macro) return strategy;

    // Upgrade for kills that happen to be difficult
    if (
      strategy === MonsterStrategy.Kill &&
      monster &&
      monsterDefense(monster) * 1.25 > myBuffedstat(weaponType(equippedItem($slot`Weapon`)))
    ) {
      strategy = MonsterStrategy.KillHard;
    }

    const delevel = new Macro()
      .skill($skill`Curse of Weaksauce`)
      .trySkill($skill`Pocket Crumbs`)
      .trySkill($skill`Micrometeorite`)
      .tryItem($item`Rain-Doh indigo cup`)
      .trySkill($skill`Summon Love Mosquito`)
      .tryItem($item`Time-Spinner`);

    switch (strategy) {
      case MonsterStrategy.RunAway:
        if (this.use_runaway === undefined)
          return new Macro()
            .runaway()
            .skill($skill`Saucestorm`)
            .attack()
            .repeat();
        else return this.use_runaway;
      case MonsterStrategy.Kill:
        if (monster && monster.physicalResistance >= 70)
          return delevel.skill($skill`Saucegeyser`).repeat();
        else return delevel.attack().repeat();
      case MonsterStrategy.KillHard:
        if (
          (monster && monster.physicalResistance >= 70) ||
          weaponType(equippedItem($slot`Weapon`)) !== $stat`muscle`
        ) {
          return delevel.skill($skill`Saucegeyser`).repeat();
        } else {
          return delevel.skill($skill`Lunging Thrust-Smack`).repeat();
        }
      case MonsterStrategy.Banish:
        if (this.use_banish === undefined) return new Macro().abort(); // should already be banished, or we are out of banishes
        return this.use_banish;
      case MonsterStrategy.Abort:
        return new Macro().abort();
    }
  }
}

export class CombatStrategy {
  default_strategy: MonsterStrategy = MonsterStrategy.RunAway;
  default_macro?: Macro;
  strategy: Map<Monster, MonsterStrategy> = new Map();
  macros: Map<Monster, Macro> = new Map();
  boss: boolean;

  constructor(boss?: boolean) {
    this.boss = boss ?? false;
  }
  apply(strategy: MonsterStrategy, ...monsters: Monster[]): CombatStrategy {
    if (monsters.length === 0) {
      this.default_strategy = strategy;
    }
    for (const monster of monsters) {
      this.strategy.set(monster, strategy);
    }
    return this;
  }
  public kill(...monsters: Monster[]): CombatStrategy {
    return this.apply(MonsterStrategy.Kill, ...monsters);
  }
  public killHard(...monsters: Monster[]): CombatStrategy {
    return this.apply(MonsterStrategy.KillHard, ...monsters);
  }
  public banish(...monsters: Monster[]): CombatStrategy {
    if (monsters.length === 0) throw `Must specify list of monsters to banish`;
    return this.apply(MonsterStrategy.Banish, ...monsters);
  }
  public flee(...monsters: Monster[]): CombatStrategy {
    return this.apply(MonsterStrategy.RunAway, ...monsters);
  }
  public item(item: Item, ...monsters: Monster[]): CombatStrategy {
    return this.macro(new Macro().item(item), ...monsters);
  }
  public abort(...monsters: Monster[]): CombatStrategy {
    return this.apply(MonsterStrategy.Abort, ...monsters);
  }
  public macro(strategy: Macro, ...monsters: Monster[]): CombatStrategy {
    if (monsters.length === 0) {
      this.default_macro = strategy;
    }
    for (const monster of monsters) {
      this.macros.set(monster, strategy);
    }
    return this;
  }

  public can(do_this: MonsterStrategy): boolean {
    if (do_this === this.default_strategy) return true;
    return Array.from(this.strategy.values()).includes(do_this);
  }

  public where(do_this: MonsterStrategy): Monster[] {
    return Array.from(this.strategy.keys()).filter((key) => this.strategy.get(key) === do_this);
  }
}
