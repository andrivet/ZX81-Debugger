

label_equ1:		equ 100


;m1:	MACRO
;	ld c,9
;.mlocal:
;	dec a
;	ENDM


	ORG 0x8000

label1:
	nop

label2:	ld a,5

_locala:	ld b,8

_localb:
	nop		; ASSERTION

label3:	;m1
 ;m1
label4:
 ;	m1

label4_1:
	; m1	; LOGPOINT

	IF 0
label5:	nop
	ld a,6
	ENDIF

label6:	nop

_local: ; local label not existing
	nop
	ld a,5
	ld hl,22



	;ORG 0x8200
data:
	defb 1, 2, 3, 4, 5, 6, 7, 8, $FA		; WPMEM
data2:	defb $FE, 2, 3, 4, 5, 6, 7, 8, 9		; WPMEM

	;ORG 0x9000

	include "filea.asm"



