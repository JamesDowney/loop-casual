import { MosquitoQuest } from "./level2";
import { BatQuest } from "./level4";
import { KnobQuest } from "./level5";
import { FriarQuest, OrganQuest } from "./level6";
import { CryptQuest } from "./level7";
import { McLargeHugeQuest } from "./level8";
import { ChasmQuest } from "./level9";
import { GiantQuest } from "./level10";
import { HiddenQuest } from "./level11_hidden";
import { ManorQuest } from "./level11_manor";
import { PalindomeQuest } from "./level11_palindome";
import { MacguffinQuest } from "./level11";
import { WarQuest } from "./level12";
import { Task } from "./structure";
import { LevelingQuest } from "./leveling";

export function all_tasks(): { [name: string]: Task } {
  const quests = [
    LevelingQuest,
    MosquitoQuest,
    BatQuest,
    KnobQuest,
    FriarQuest,
    OrganQuest,
    CryptQuest,
    McLargeHugeQuest,
    ChasmQuest,
    GiantQuest,
    HiddenQuest,
    ManorQuest,
    PalindomeQuest,
    MacguffinQuest,
    WarQuest,
  ];

  const result: { [name: string]: Task } = {};
  for (const quest of quests) {
    for (const task of quest.tasks) {
      // Include quest name in task names and dependencies (unless dependency quest is given)
      task.name = `${quest.name}/${task.name}`;
      task.after = task.after.map((after) =>
        after.includes("/") ? after : `${quest.name}/${after}`
      );
      result[task.name] = task;
    }
  }
  return result;
}
