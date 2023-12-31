; Note: For bank border tests the sjasmplus generated binary is
; assembled in a special memory mode.
; Instead the slots are generated by the tests:
; 0x0000-0x3FFF:	single banked (true)
; 0x4000-0x7FFF:	single banked (true)
; 0x8000-0x7FFF:	multi banked/not used (false)


	DEFS 0x0000
SUB_0000:
	NOP
	RET


	DEFS 0x0100-$
	; Simple calls to other banks
	LD A,5
	LD DE,$0000
	LD HL,(SUB_0000)	; Found
	CALL SUB_0000		; Found

	LD B,C
	LD DE,$4000
	LD HL,(SUB_4000)	; Found
	CALL SUB_4000		; Found

	LD DE,$8010
	LD HL,($8010)	; bank border
	CALL $8000		; bank border

	NOP
	RET


	DEFS 0x4000-$
SUB_4000:
	NOP
	RET


	DEFS 0x6000-$
	; Self modifying code through bank border.
	; See also test at 0xE000.
	LD A,$1
	LD ($E00C),A
	CALL $E009
	RET


	DEFS 0x8000-$
SUB_8000:
	NOP
	RET
	DEFS 0x8010-$
LBL_8010:
	DEFW 0


	DEFS 0x8100-$
	; Simple calls to other banks
	CALL SUB_0000		; Found

	CALL SUB_4000		; Found

	CALL SUB_8000		; Found

	RET


	DEFS 0xD000-$
	; Loop: Label prior to subroutine, misc references
	CALL SUB_D007
	RET

LBL_D004:
	LD A,$08

.LOOP:
	NOP

SUB_D007:
	LD (IX+5),A

.LOOP:
	LD A,(IY-7)
	JR Z,.LOOP

	BIT 7,(IX)
	JR NZ,.L1

	LD BC,(DATA_D100)

.L1:
	LD (DATA_D102),DE
	LD IY,(DATA_D104)
	JP P,.L2

	RET

.L2:
	NEG
	JR Z,LBL_D004

	JP NC,LBL_D004.LOOP

	RET

	DEFS 0xD100 -$

DATA_D100:
	DEFW 0xBCBC

DATA_D102:
	DEFW 0xDEDE

DATA_D104:
	DEFW 0x1111


	DEFS 0xD200-$
	; 2 subroutines merged
	CALL SUB_D207
	CALL SUB_D209
	RET

SUB_D207:
	LD A,$01
SUB_D209:
	LD A,$02
	RET


	DEFS 0xD300-$
	; 2 subroutines,sharing tail
	CALL SUB_D307
	CALL SUB_D30B
	RET

SUB_D307:
	LD A,$01
	JR SUB_D30B.L1
SUB_D30B:
	LD A,$02
.L1:
	RET


	DEFS 0xD400-$
	; subroutine with jumps < subroutine address
	CALL SUB_D408
	RET

LBL_D404:
	LD A,$01

.L1:
	LD A,$02

SUB_D408:
	LD A,$03

.LOOP:
	LD A,$04
	JR Z,.LOOP

	LD A,$05
	JR NZ,.L1

	LD A,$06

.L1:
	JP P,.L2

	RET

.L2:
	NEG
	JR Z,LBL_D404

	JP NC,LBL_D404.L1

	RET


	DEFS 0xD500-$
	; subroutine with jumps < subroutine address, with additional JP
	CALL SUB_D509
	RET

LBL_D504:
	LD A,$01
	JP SUB_D509

SUB_D509:
	LD A,$02
	JP NC,LBL_D504

	RET


	DEFS 0xD600-$
	; subroutine with jumps < subroutine address, with additional JP with hole
	CALL SUB_D60A
	RET

LBL_D604:
	LD A,$01
	JP SUB_D60A

	NOP	; "Hole"

SUB_D60A:
	LD A,$02
	JP NC,LBL_D604

	RET


	DEFS 0xE000-$
	; Self modifying code
	LD A,$1
	LD (SUB_E009.L1+1),A
	CALL SUB_E009
	RET

SUB_E009:
	LD A,$02
.L1:	; This does not split the nodes but is a referenced (otherLabels)
	LD B,$00	; Modified
	RET


	DEFS 0xE100-$
	LD A,(DATA_E107)
	LD HL,DATA_E107
	RET

DATA_E107:	DEFB 0

