# Breakpoints, Watchpoints, Logpoints Handling

For ZEsarUX there is a special handling of Continue, StepOver, StepIn, StepOut.

For DZRP (CSpect, serial) there is a more generalized approach which is discussed below.


# DZRP handling

In DZRP the remote (e.g. the emulator) need not support StepOver, StepInto, StepOut. It just needs to support Continue and breakpoints.
I.e. simplified spoken a StepOver is done by putting a temporary breakpoint at the next execution point and doing a Continue.
As there are sometimes 2 different possible executions points (e.g. JP cc,nnnn) in reality 2 temporary breakpoints are set.

- Continue: no temporary breakpoint
- StepOver: temporary breakpoint at the next PC + special handling, e.g. for RET a breakpoint is set at the position the SP is pointing at.
- StepInto: temporary breakpoint at the next PC + a temporary breakpoint at the other branch position. Note: the flags are not evaluated to see what is the next branch position. Instead a breakpoint is set on both positions.

~~~puml
hide footbox
title Continue
participant vscode
participant DebugSessionClass
participant Remote
participant Emulator as "Ext. remote\n(emulator)"

vscode -> DebugSessionClass: Continue/StepInto/\nStepOver/StepOut
DebugSessionClass -> Remote: Continue/StepInto/\nStepOver/StepOut
Remote -> Emulator: Continue
~~~


## StepOut

So far Continue, StepOver, StepInto are handled by the remote simply as a Continue.
StepOut is different as this is handled inside DeZog in the DZRP Remote implementation as a loop.

Algorithm:
1. StepOut gets the SP (prevSP).
2. Do a StepOver.
3. Check current SP. If SP<=prevSp then goto 2


~~~puml
hide footbox
title StepOut
participant vscode
participant DebugSessionClass
participant Remote
participant Emulator as "Ext. remote\n(emulator)"

vscode -> DebugSessionClass: StepOut
DebugSessionClass -> Remote: StepOut

loop until SP too big
Remote -> Emulator: Continue
Remote <-- Emulator: break
Remote -> Emulator: Get SP
Remote <-- Emulator: SP
end
~~~


# Breakpoint conditions and logpoints

DZRP does not require the remote (the emulator) to support breakpoint conditions or logpoints.

Instead the breakpoint condition/logpoint is handled inside DeZog.
Breakpoints with conditions and logpoints are sent to the remote as "normal" PC breakpoints without condition.

When the Z80 program passes such an address a break happens and DeZog gets control.
DeZog will then examine the breakpoint condition and/or the log.
If the condition is not true DeZog will simply send a Continue to the remote.
If a log is present DeZog will print the log and also send a Continue to the remote.

This algorithm is slower then handling it all at the remote (the emulator) but has the advantage that it works even if the remote does nto support breakpoint conditions or logpoints and that the condition and log syntax is always the same, no matter what remote is used.


~~~puml
hide footbox
title Continue/StepOver/StepInto/StepOut
participant vscode
participant DebugSessionClass
participant Remote
participant Emulator as "Ext. remote\n(emulator)"

vscode -> DebugSessionClass: Continue/StepOver etc.
DebugSessionClass -> Remote: Continue/StepOver etc.

loop until "real" break
Remote -> Emulator: Continue
Remote <-- Emulator: break
note over Remote: Evaluate breakpoint:\nIf condition is true:\n  - If log then print log and continue\n  - Otherwise break ("real")
end
~~~


## Breakpoint IDs

Watchpoints (read/write) can be set for whole areas (e.g. 0x1000-0x1FFF). They are not related to any ID but the addresses are used directly.

Breakpoints (including ASSERTs and LOGPOINTs) use IDs. Also at the remote (emulator) side.
IDs are required at remote side to allow conditional breakpoints also at the external remote.
I.e. it could happen that there are 2 breakpoints at the same address but with different conditions.
Still it must be possible to distinguish both to remove one of them but keepingthe other.

The remote's ability to support conditions is optional. As we learned above, DeZog will handle them anyway. But if the remote would support conditions as well the whole handling will become much faster since no communication would be involved to check the condition.
But note: currently CSpect does not support conditions and for serial/ZXNext it seems also unlikely that conditions will be supported.
However the DZRP protocol would allow it.

ASSERTs: These are just breakpoints with inverted conditions. They are handled inside DeZog. For the remote they are simply breakpoints (with a condition).

LOGPOINTs: Are handled by DeZog only. Unlike conditions the DZRP does not support logpoints. For the remote a logpoint is just a breakpoint (and could additionally include a condition). The logpoint printing is completely evaluated and done in DeZog.


When a breakpoint is hit in the (external) remote the address (instead of the ID) is returned in the pause-notification.
The reason is:
Several breakpoints could share the same address. Imagine a LOGPOINT or an ASSERT at address 0x8000. The user might set additionaly a breakpoint (with no or another condition) in the vscode GUI at the same location.
The DzrpRemote inside DeZog will then find all breakpoints that correspond to that address and check them all. If any's condition is true a break is done otherwise a Continue is sent.

When a Watchpoint is hit the watch address is returned if the remote does know it (e.g. CSpect can detect an access but does not return the address).
The Remote (in Dezog) has to know about the remote's capability in this respect.







# Improved StepOver handling

For both (ZEsarUX and DZRP) there is an additional handling of the StepOver on top of the already shown behavior.

It is handled in the DebugAdapter (DebugSessionClass) and therefore available to all Remotes.

Normally a StepOver steps over an Z80 instruction. But this means that in case of macros, fake instruction (sjasmplus) or multiple instructions on one line a StepOver does not step over the whole line but just steps over one Z80 instruction.

Example:
~~~
  ld a,(hl) : inc hl
~~~
A "normal" StepOver would first step-over "ld a,(hl)" but stay in the same line.
The second step-over would step-over "inc hl" and the PC indicator moves to the next line.

The **Improved StepOver** handling now basically repeats the "normal" StepOver as long as the resulting file/line is not changed.
So a step over always moves to he next line.

The StepInto handling is unchanged, i.e. with StepInto you could still step through the Z80 instructions one-by-one.



~~~puml
hide footbox
title Improved StepOver
participant vscode
participant DebugSessionClass
participant Remote
participant Emulator as "Ext. remote\n(emulator)"

vscode -> DebugSessionClass: StepOver

loop until file/line changed
DebugSessionClass -> Remote: StepOver
Remote -> Emulator: Continue
Remote <-- Emulator: break
DebugSessionClass <-- Remote: break

DebugSessionClass -> Remote: Get PC
Remote -> Emulator: Get PC
Remote <-- Emulator: PC
DebugSessionClass <-- Remote:  PC

note over DebugSessionClass: Lookup file/line from PC
end
~~~