|SLD.data.version|1
||K|KEYWORDS|WPMEM,LOGPOINT,ASSERTION
main.asm|2||0|-1|-1|Z|pages.size:65536,pages.count:32,slots.count:1,slots.adr:0
main.asm|6||0|-1|131|D|DMA_DISABLE
main.asm|6||0|-1|131|L|,DMA_DISABLE,,+equ,+used
main.asm|7||0|-1|135|D|DMA_ENABLE
main.asm|7||0|-1|135|L|,DMA_ENABLE,,+equ,+used
main.asm|8||0|-1|207|D|DMA_LOAD
main.asm|8||0|-1|207|L|,DMA_LOAD,,+equ,+used
main.asm|9||0|-1|107|D|ZXN_DMA_PORT
main.asm|9||0|-1|107|L|,ZXN_DMA_PORT,,+equ,+used
zxndma.asm|8||0|-1|0|L|zxndma,,,+module
zxndma.asm|14||0|0|0|F|zxndma.fill
zxndma.asm|14||0|0|0|L|zxndma,fill,,+used
zxndma.asm|15||0|0|0|T|
zxndma.asm|16||0|0|1|T|
zxndma.asm|17||0|0|4|T|
zxndma.asm|18||0|0|8|T|
zxndma.asm|19||0|0|12|T|
zxndma.asm|20||0|0|15|T|
zxndma.asm|21||0|0|17|T|
zxndma.asm|22||0|0|19|T|
zxndma.asm|23||0|0|21|T|
zxndma.asm|24||0|0|22|T|
zxndma.asm|26||0|0|23|F|zxndma.fill.fill_value
zxndma.asm|26||0|0|23|L|zxndma,fill,fill_value,+used
zxndma.asm|27||0|0|24|F|zxndma.fill.dma_code
zxndma.asm|27||0|0|24|L|zxndma,fill,dma_code,+used
zxndma.asm|29||0|0|26|F|zxndma.fill.dma_source
zxndma.asm|29||0|0|26|L|zxndma,fill,dma_source
zxndma.asm|30||0|0|28|F|zxndma.fill.dma_length
zxndma.asm|30||0|0|28|L|zxndma,fill,dma_length,+used
zxndma.asm|34||0|0|33|F|zxndma.fill.dma_dest
zxndma.asm|34||0|0|33|L|zxndma,fill,dma_dest,+used
zxndma.asm|37||0|-1|13|D|zxndma.fill.dma_len
zxndma.asm|37||0|-1|13|L|zxndma,fill,dma_len,+equ,+used
zxndma.asm|39||0|-1|37|L|zxndma,,,+endmod
main.asm|18||0|0|256|F|main
main.asm|18||0|0|256|L|,main,
main.asm|19||0|0|256|T|
main.asm|20||0|0|257|F|main.loop
main.asm|20||0|0|257|L|,main,loop,+used
main.asm|21||0|0|257|T|
main.asm|22||0|0|259|T|
main.asm|23||0|0|262|T|
main.asm|24||0|0|265|T|
main.asm|25||0|0|268|T|
main.asm|26||0|0|269|T|