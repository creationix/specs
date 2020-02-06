type Selector = Matcher
    | ExploreAll
    | ExploreFields
    | ExploreIndex
    | ExploreRange
    | ExploreRecursive
    | ExploreUnion
    | ExploreConditional
    | ExploreRecursiveEdge

type RecursionLimit = RecursionLimit_None | RecursionLimit_Depth
declare class RecursionLimit_None { }
type RecursionLimit_Depth = number
declare class ExploreRecursiveEdge { }
declare class Condition { }

declare class Matcher {
    constructor(onlyIf?: Condition, label?: string)
}
declare class ExploreAll {
    constructor(next: Selector)
}
declare class ExploreFields {
    constructor(fields: { [field: string]: Selector })
}
declare class ExploreIndex {
    constructor(index: number, next: Selector)
}
declare class ExploreRange {
    constructor(start: number, end: number, next: Selector)
}
declare class ExploreRecursive {
    constructor(limit: RecursionLimit, sequence: Selector, stopAt?: Condition)
}
declare class ExploreUnion {
    constructor(...list: Selector[])
}
declare class ExploreConditional {
    constructor(condition: Condition, next: Selector)
}
