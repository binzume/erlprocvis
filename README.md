# Erlang process visualizer

ErlangのプロセスをWebGLで表示するWebアプリ(と，RubyでErlangノードと通信するためのモジュール)です．

RubyからErlangのノードに[Distribution Protocol](http://www.erlang.org/doc/apps/erts/erl_dist_protocol.html)で接続してRPCしたりします．
プロトコルの勉強ついでに作ったやつなので実用性は皆無です．

![procvis](procvis.png)


- Distribution Protocol http://www.erlang.org/doc/apps/erts/erl_dist_protocol.html
- External Term Format http://www.erlang.org/doc/apps/erts/erl_ext_dist.html
- http://www.erlang.org/doc/man/erlang.html#process_info-2

## Usage

1. gem install sinatra sinatra-contrib
2. 適当なErlangアプリケーションを分散モードで起動(例: erl -sname hoge )
3. rackup -p 2400
4. ブラウザで開く `http://localhost:2400/`

操作

- クリック: 選択
- ダブルクリック: ノード詳細表示
- 左ボタンドラッグ: カメラ回転
- 中ボタンドラッグ: カメラ移動
- 右ボタンドラッグ: カメラ距離
- R: リロード
- T: 自動回転on/off
- Y: 自動リロードon/off

表示サンプル(静的ページです)

- Cowboy http://binzume.github.io/erlprocvis/public/procs.html?procs=sample.json
- RabbitMQ http://binzume.github.io/erlprocvis/public/procs.html?procs=sample-mq.json


## Usage2

``` cmd
irb
irb(main):001:0> require_relative 'erlang'
=> true
irb(main):002:0> erl = Erlang::Erl.new('rubynode@test', File.read(ENV['HOME']+"/.erlang.cookie"))
=> ...
irb(main):003:0> erl.nodes
=> ["node1"]
irb(main):004:0> erl.rpc_call(erl.nodes[0], :io, :format, ["Hello!\n"])
=> :ok
irb(main):005:0> erl.eval(erl.nodes[0], "1 + 1.")
=> 2
```


# License

Copyright 2016 Kousuke Kawahira

Released under the MIT license
