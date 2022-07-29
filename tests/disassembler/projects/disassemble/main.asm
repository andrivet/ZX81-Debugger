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

	CALL SUB_D003
	JR $

LBL_D000:
	LD A,$08

LBL_D002:
	NOP
	JP SUB_D003

	nop
	nop

SUB_D003:
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
	JR Z,LBL_D000

	JP NC,LBL_D002

	RET

	DEFS 0xD100 -$

DATA_D100:
	DEFW 0xBCBC

DATA_D102:
	DEFW 0xDEDE

DATA_D104:
	DEFW 0x1111



	DEFS 0xE000-$
	; Self modifying code
SUB_E000:

	RET
